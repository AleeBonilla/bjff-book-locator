import { Injectable } from '@nestjs/common';
import type {
  Paginado,
  Scheme,
  SchemeDetail,
  SchemeLocation,
  SchemeUnavailableReason,
  SubtreePreview,
} from '@bjff/api-types';

import { ApiError } from '../common/api-error.js';
import { logger } from '../common/logger.js';
import { isExactPermutation, subtreeIds, wouldCreateCycle } from './structure-tree.js';
import type {
  CreateLocationDto,
  CreateSchemeDto,
  CopySchemeDto,
  MoveLocationDto,
  OrderLocationsDto,
  ReplaceLocationSettingsDto,
  UpdateLocationDto,
  UpdateSchemeDto,
} from './schemes.dto.js';
import {
  SchemesRepository,
  type LocationJoined,
  type SchemeWithCreator,
} from './schemes.repository.js';

@Injectable()
export class SchemesService {
  constructor(private readonly repository: SchemesRepository) {}

  async list(options: {
    status?: 'DRAFT' | 'DEFINED' | 'DISTRIBUTED';
    enabled?: boolean;
    limit: number;
    offset: number;
  }): Promise<Paginado<Scheme>> {
    const result = await this.repository.list(options);
    const items = await Promise.all(
      result.rows.map(async (row) =>
        toScheme(row, await this.repository.locations(row.scheme_id)),
      ),
    );
    return { items, total: result.total };
  }

  async detail(schemeId: number): Promise<SchemeDetail> {
    const [scheme, rows] = await Promise.all([
      this.repository.scheme(schemeId),
      this.repository.locations(schemeId),
    ]);
    if (!scheme) throw ApiError.notFound('SCHEME_NOT_FOUND', 'El scheme no existe.');
    return { ...toScheme(scheme, rows), locations: buildLocationTree(rows) };
  }

  async create(dto: CreateSchemeDto, createdBy: number | null): Promise<SchemeDetail> {
    const row = await this.repository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      status: 'DRAFT',
      enabled: true,
      is_active: false,
      based_on_scheme_id: null,
      created_by: createdBy,
    });
    return this.detail(row.scheme_id);
  }

  async update(schemeId: number, dto: UpdateSchemeDto): Promise<SchemeDetail> {
    await this.assertScheme(schemeId);
    await this.repository.update(schemeId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...('description' in dto ? { description: dto.description?.trim() || null } : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
    });
    return this.detail(schemeId);
  }

  async createLocation(
    schemeId: number,
    dto: CreateLocationDto,
  ): Promise<SchemeLocation> {
    const rows = await this.assertEditable(schemeId);
    const node = await this.repository.templateNode(
      dto.structureTemplateId,
      dto.structureTemplateNodeId,
    );
    if (!node) {
      throw ApiError.notFound(
        'TEMPLATE_NODE_NOT_FOUND',
        'El nodo de plantilla no existe.',
      );
    }
    if (
      node.template_status !== 'ACTIVE' ||
      !node.template_enabled ||
      !(await this.repository.templatePathEnabled(
        dto.structureTemplateId,
        dto.structureTemplateNodeId,
      ))
    ) {
      throw ApiError.invalid(
        'INVALID_PARENT',
        'La plantilla o la ruta seleccionada no está disponible para nuevas locations.',
      );
    }

    const parentId = dto.parentLocationId ?? null;
    if (parentId === null) {
      if (node.parent_template_node_id !== null) {
        throw ApiError.invalid(
          'INVALID_PARENT',
          'Una raíz debe instanciar el nodo raíz de su plantilla.',
        );
      }
    } else {
      const parent = this.findLocation(rows, parentId);
      if (
        parent.role === 'POSITION' ||
        parent.structure_template_id !== dto.structureTemplateId ||
        parent.structure_template_node_id !== node.parent_template_node_id
      ) {
        throw ApiError.invalid(
          'INVALID_PARENT',
          'La location hija no corresponde a la jerarquía de la plantilla.',
        );
      }
    }

    const created = await this.repository.createLocation(
      schemeId,
      {
        parent_location_id: parentId,
        structure_template_id: dto.structureTemplateId,
        structure_template_node_id: dto.structureTemplateNodeId,
        name: dto.name.trim(),
        leaf_sequence: null,
        map_element_id: dto.mapElementId?.trim() || null,
        enabled: dto.enabled ?? true,
      },
      dto.position,
    );
    return findNestedLocation(
      (await this.detail(schemeId)).locations,
      created.location_id,
    )!;
  }

  async updateLocation(
    schemeId: number,
    locationId: number,
    dto: UpdateLocationDto,
  ): Promise<SchemeLocation> {
    const rows = await this.assertEditable(schemeId);
    this.findLocation(rows, locationId);
    await this.repository.updateLocation(locationId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...('mapElementId' in dto
        ? { map_element_id: dto.mapElementId?.trim() || null }
        : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
    });
    return findNestedLocation((await this.detail(schemeId)).locations, locationId)!;
  }

  async moveLocation(
    schemeId: number,
    locationId: number,
    dto: MoveLocationDto,
  ): Promise<void> {
    const rows = await this.assertEditable(schemeId);
    const location = this.findLocation(rows, locationId);
    const parentId = dto.parentLocationId ?? null;
    if (wouldCreateCycle(toTreeNodes(rows), locationId, parentId)) {
      throw ApiError.invalid('TREE_CYCLE', 'El movimiento produciría un ciclo.');
    }
    const templateNode = await this.repository.templateNode(
      location.structure_template_id,
      location.structure_template_node_id,
    );
    if (parentId === null) {
      if (templateNode?.parent_template_node_id !== null) {
        throw ApiError.invalid(
          'INVALID_PARENT',
          'Solo un nodo raíz puede quedar como raíz.',
        );
      }
    } else {
      const parent = this.findLocation(rows, parentId);
      if (
        parent.role === 'POSITION' ||
        parent.structure_template_id !== location.structure_template_id ||
        parent.structure_template_node_id !== templateNode?.parent_template_node_id
      ) {
        throw ApiError.invalid(
          'INVALID_PARENT',
          'El nuevo padre no corresponde a la plantilla.',
        );
      }
    }
    await this.repository.moveLocation(schemeId, locationId, parentId, dto.position);
  }

  async orderLocations(schemeId: number, dto: OrderLocationsDto): Promise<void> {
    const rows = await this.assertEditable(schemeId);
    const parentId = dto.parentLocationId ?? null;
    const current = rows
      .filter((row) => row.parent_location_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((row) => row.location_id);
    if (!isExactPermutation(current, dto.orderedLocationIds)) {
      throw ApiError.invalid(
        'ORDER_MISMATCH',
        'La lista debe contener exactamente todos los elementos del grupo.',
      );
    }
    await this.repository.orderLocations(dto.orderedLocationIds);
  }

  async deletionPreview(schemeId: number, locationId: number): Promise<SubtreePreview> {
    const rows = await this.assertEditable(schemeId);
    const location = this.findLocation(rows, locationId);
    const ids = subtreeIds(toTreeNodes(rows), locationId);
    const byId = new Map(rows.map((row) => [row.location_id, row]));
    return {
      root: { id: locationId, name: location.name, role: location.role },
      descendantCount: ids.length - 1,
      items: ids.map((id) => {
        const row = byId.get(id)!;
        return { id, parentId: row.parent_location_id, name: row.name, role: row.role };
      }),
    };
  }

  async deleteLocation(
    schemeId: number,
    locationId: number,
    confirmed: boolean,
  ): Promise<void> {
    const preview = await this.deletionPreview(schemeId, locationId);
    if (preview.descendantCount > 0 && !confirmed) {
      throw ApiError.conflict(
        'SUBTREE_CONFIRMATION_REQUIRED',
        'Debe confirmar la eliminación del subárbol completo.',
        { preview },
      );
    }
    await this.repository.deleteLocations(preview.items.map((item) => item.id));
  }

  async define(schemeId: number): Promise<SchemeDetail> {
    await this.assertScheme(schemeId);
    const startedAt = Date.now();
    logger.info('scheme_define_started', { schemeId });
    try {
      const positions = await this.repository.define(schemeId);
      logger.info('scheme_define_finished', {
        schemeId,
        positions,
        durationMs: Date.now() - startedAt,
        outcome: 'success',
      });
      return this.detail(schemeId);
    } catch (error) {
      logger.warn('scheme_define_finished', {
        schemeId,
        durationMs: Date.now() - startedAt,
        outcome: 'failure',
      });
      throw error;
    }
  }

  async replaceSettings(
    schemeId: number,
    locationId: number,
    dto: ReplaceLocationSettingsDto,
    updatedBy: number | null,
  ): Promise<SchemeLocation | null> {
    const scheme = await this.assertScheme(schemeId);
    if (scheme.status !== 'DRAFT' && scheme.status !== 'DEFINED') {
      throw ApiError.conflict(
        'INVALID_STATE_TRANSITION',
        'Los settings solo pueden cambiar en DRAFT o DEFINED.',
      );
    }
    const rows = await this.repository.locations(schemeId);
    const location = this.findLocation(rows, locationId);
    const hasValue =
      dto.capacity != null || dto.targetFillRatio != null || dto.allowOverflow != null;
    if (!hasValue) {
      await this.repository.deleteSettings(schemeId, locationId);
      return null;
    }
    await this.repository.replaceSettings(schemeId, locationId, {
      capacityValue: dto.capacity?.value ?? null,
      capacityUnit: dto.capacity?.unit ?? null,
      targetFillRatio: dto.targetFillRatio ?? null,
      allowOverflow: dto.allowOverflow ?? null,
      inheritToDescendants: location.role === 'CONTAINER',
      updatedBy,
    });
    return findNestedLocation((await this.detail(schemeId)).locations, locationId)!;
  }

  async copy(
    sourceSchemeId: number,
    dto: CopySchemeDto,
    createdBy: number | null,
  ): Promise<SchemeDetail> {
    await this.assertScheme(sourceSchemeId);
    const startedAt = Date.now();
    logger.info('scheme_copy_started', { sourceSchemeId });
    try {
      const copied = await this.repository.copy(sourceSchemeId, {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        createdBy,
      });
      logger.info('scheme_copy_finished', {
        sourceSchemeId,
        schemeId: copied.schemeId,
        locations: copied.locations,
        durationMs: Date.now() - startedAt,
        outcome: 'success',
      });
      return this.detail(copied.schemeId);
    } catch (error) {
      logger.warn('scheme_copy_finished', {
        sourceSchemeId,
        durationMs: Date.now() - startedAt,
        outcome: 'failure',
      });
      throw error;
    }
  }

  async deleteSettings(schemeId: number, locationId: number): Promise<void> {
    const scheme = await this.assertScheme(schemeId);
    if (scheme.status !== 'DRAFT' && scheme.status !== 'DEFINED') {
      throw ApiError.conflict(
        'INVALID_STATE_TRANSITION',
        'Los settings solo pueden cambiar en DRAFT o DEFINED.',
      );
    }
    this.findLocation(await this.repository.locations(schemeId), locationId);
    await this.repository.deleteSettings(schemeId, locationId);
  }

  private async assertScheme(schemeId: number): Promise<SchemeWithCreator> {
    const scheme = await this.repository.scheme(schemeId);
    if (!scheme) throw ApiError.notFound('SCHEME_NOT_FOUND', 'El scheme no existe.');
    return scheme;
  }

  private async assertEditable(schemeId: number): Promise<LocationJoined[]> {
    const scheme = await this.assertScheme(schemeId);
    if (scheme.status !== 'DRAFT') {
      throw ApiError.conflict(
        'SCHEME_NOT_EDITABLE',
        'La estructura solo puede cambiar mientras el scheme está en DRAFT.',
      );
    }
    return this.repository.locations(schemeId);
  }

  private findLocation(rows: LocationJoined[], locationId: number): LocationJoined {
    const row = rows.find((candidate) => candidate.location_id === locationId);
    if (!row)
      throw ApiError.notFound(
        'LOCATION_NOT_FOUND',
        'La location no existe en el scheme.',
      );
    return row;
  }
}

function toScheme(row: SchemeWithCreator, locations: LocationJoined[]): Scheme {
  const reasons: SchemeUnavailableReason[] = [];
  if (!row.enabled) reasons.push('SCHEME_DISABLED');
  if (row.status !== 'DEFINED') reasons.push('SCHEME_NOT_DEFINED');
  if (locations.some((location) => !location.template_enabled))
    reasons.push('TEMPLATE_DISABLED');
  if (
    !locations.some(
      (location) => location.role === 'POSITION' && isUsable(locations, location),
    )
  ) {
    reasons.push('NO_USABLE_POSITIONS');
  }
  return {
    schemeId: row.scheme_id,
    name: row.name,
    description: row.description,
    status: row.status,
    enabled: row.enabled,
    isActive: row.is_active,
    basedOnSchemeId: row.based_on_scheme_id,
    availableForNewRun: reasons.length === 0,
    unavailableReasons: reasons,
    createdBy:
      row.created_by !== null && row.creator_username
        ? { userId: row.created_by, username: row.creator_username }
        : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function buildLocationTree(rows: LocationJoined[]): SchemeLocation[] {
  const children = new Map<number | null, LocationJoined[]>();
  for (const row of rows) {
    const group = children.get(row.parent_location_id) ?? [];
    group.push(row);
    children.set(row.parent_location_id, group);
  }
  for (const group of children.values())
    group.sort((a, b) => a.sort_order - b.sort_order);
  const build = (row: LocationJoined): SchemeLocation => ({
    locationId: row.location_id,
    parentLocationId: row.parent_location_id,
    structureTemplateId: row.structure_template_id,
    structureTemplateNodeId: row.structure_template_node_id,
    name: row.name,
    role: row.role,
    position: row.sort_order,
    leafSequence: row.leaf_sequence,
    mapElementId: row.map_element_id,
    enabled: row.enabled,
    usable: isUsable(rows, row),
    settings:
      row.inherit_to_descendants === null || row.setting_updated_at === null
        ? null
        : {
            capacity:
              row.capacity_value !== null && row.capacity_unit !== null
                ? { value: Number(row.capacity_value), unit: row.capacity_unit }
                : null,
            targetFillRatio:
              row.target_fill_ratio === null ? null : Number(row.target_fill_ratio),
            allowOverflow: row.allow_overflow,
            inheritToDescendants: row.inherit_to_descendants,
            updatedBy:
              row.setting_updated_by !== null && row.setting_username
                ? { userId: row.setting_updated_by, username: row.setting_username }
                : null,
            updatedAt: new Date(row.setting_updated_at).toISOString(),
          },
    children: (children.get(row.location_id) ?? []).map(build),
  });
  return (children.get(null) ?? []).map(build);
}

function isUsable(rows: LocationJoined[], row: LocationJoined): boolean {
  if (
    !row.template_enabled ||
    (row.template_status !== 'ACTIVE' && row.template_status !== 'ARCHIVED')
  ) {
    return false;
  }
  const byId = new Map(rows.map((candidate) => [candidate.location_id, candidate]));
  let current: LocationJoined | undefined = row;
  const visited = new Set<number>();
  while (current) {
    if (!current.enabled || !current.node_enabled || visited.has(current.location_id))
      return false;
    visited.add(current.location_id);
    if (current.parent_location_id === null) return true;
    current = byId.get(current.parent_location_id);
  }
  return false;
}

function toTreeNodes(rows: LocationJoined[]) {
  return rows.map((row) => ({
    id: row.location_id,
    parentId: row.parent_location_id,
    position: row.sort_order,
    role: row.role,
    enabled: row.enabled,
  }));
}

function findNestedLocation(nodes: SchemeLocation[], id: number): SchemeLocation | null {
  for (const node of nodes) {
    if (node.locationId === id) return node;
    const child = findNestedLocation(node.children, id);
    if (child) return child;
  }
  return null;
}
