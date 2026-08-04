import { Injectable } from '@nestjs/common';
import type {
  Paginado,
  StructureTemplate,
  StructureTemplateDetail,
  SubtreePreview,
  TemplateNode,
} from '@bjff/api-types';

import { ApiError } from '../common/api-error.js';
import type { StructureTemplateNodeRow } from '../database/schema.types.js';
import {
  isExactPermutation,
  subtreeIds,
  wouldCreateCycle,
} from '../schemes/structure-tree.js';
import type {
  CreateStructureTemplateDto,
  CreateTemplateNodeDto,
  MoveTemplateNodeDto,
  OrderTemplateNodesDto,
  UpdateStructureTemplateDto,
  UpdateTemplateNodeDto,
} from './structure-templates.dto.js';
import {
  StructureTemplatesRepository,
  type TemplateWithCreator,
} from './structure-templates.repository.js';

@Injectable()
export class StructureTemplatesService {
  constructor(private readonly repository: StructureTemplatesRepository) {}

  async list(options: {
    status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    enabled?: boolean;
    limit: number;
    offset: number;
  }): Promise<Paginado<StructureTemplate>> {
    const result = await this.repository.list(options);
    return { items: result.rows.map(toTemplate), total: result.total };
  }

  async detail(templateId: number): Promise<StructureTemplateDetail> {
    const [template, nodes] = await Promise.all([
      this.repository.template(templateId),
      this.repository.nodes(templateId),
    ]);
    if (!template) {
      throw ApiError.notFound('TEMPLATE_NOT_FOUND', 'La plantilla no existe.');
    }
    return { ...toTemplate(template), nodes: buildNodeTree(nodes) };
  }

  async create(
    dto: CreateStructureTemplateDto,
    createdBy: number | null,
  ): Promise<StructureTemplateDetail> {
    const row = await this.repository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      status: 'DRAFT',
      enabled: true,
      created_by: createdBy,
    });
    return this.detail(row.structure_template_id);
  }

  async update(
    templateId: number,
    dto: UpdateStructureTemplateDto,
  ): Promise<StructureTemplateDetail> {
    await this.assertTemplate(templateId);
    await this.repository.update(templateId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...('description' in dto ? { description: dto.description?.trim() || null } : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
    });
    return this.detail(templateId);
  }

  async createNode(
    templateId: number,
    dto: CreateTemplateNodeDto,
  ): Promise<TemplateNode> {
    const nodes = await this.assertEditable(templateId);
    const parentId = dto.parentTemplateNodeId ?? null;
    this.validateParent(nodes, parentId);
    this.validateDefaults(dto.role, dto.defaults);

    const row = await this.repository.createNode(
      templateId,
      {
        parent_template_node_id: parentId,
        name: dto.name.trim(),
        role: dto.role,
        visual_kind: dto.visualKind?.trim() || null,
        enabled: dto.enabled ?? true,
        ...defaultsToColumns(dto.defaults),
      },
      dto.position,
    );
    return toNode(row, []);
  }

  async updateNode(
    templateId: number,
    nodeId: number,
    dto: UpdateTemplateNodeDto,
  ): Promise<TemplateNode> {
    const nodes = await this.assertEditable(templateId);
    const node = this.findNode(nodes, nodeId);
    const nextRole = dto.role ?? node.role;
    const children = nodes.filter(
      (candidate) => candidate.parent_template_node_id === nodeId,
    );
    if (nextRole === 'POSITION' && children.length > 0) {
      throw ApiError.invalid('INVALID_PARENT', 'Un nodo POSITION no puede tener hijas.');
    }
    if ('defaults' in dto) this.validateDefaults(nextRole, dto.defaults);

    await this.repository.updateNode(nodeId, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...('visualKind' in dto ? { visual_kind: dto.visualKind?.trim() || null } : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...('defaults' in dto ? defaultsToColumns(dto.defaults) : {}),
    });
    const updated = (await this.repository.nodes(templateId)).find(
      (candidate) => candidate.structure_template_node_id === nodeId,
    );
    return toNode(updated!, []);
  }

  async moveNode(
    templateId: number,
    nodeId: number,
    dto: MoveTemplateNodeDto,
  ): Promise<void> {
    const nodes = await this.assertEditable(templateId);
    this.findNode(nodes, nodeId);
    const parentId = dto.parentTemplateNodeId ?? null;
    this.validateParent(nodes, parentId, nodeId);
    if (wouldCreateCycle(toTreeNodes(nodes), nodeId, parentId)) {
      throw ApiError.invalid('TREE_CYCLE', 'El movimiento produciría un ciclo.');
    }
    await this.repository.moveNode(templateId, nodeId, parentId, dto.position);
  }

  async orderNodes(templateId: number, dto: OrderTemplateNodesDto): Promise<void> {
    const nodes = await this.assertEditable(templateId);
    const parentId = dto.parentTemplateNodeId ?? null;
    const current = nodes
      .filter((node) => node.parent_template_node_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((node) => node.structure_template_node_id);
    if (!isExactPermutation(current, dto.orderedNodeIds)) {
      throw ApiError.invalid(
        'ORDER_MISMATCH',
        'La lista debe contener exactamente todos los elementos del grupo.',
      );
    }
    await this.repository.orderNodes(dto.orderedNodeIds);
  }

  async deletionPreview(templateId: number, nodeId: number): Promise<SubtreePreview> {
    const nodes = await this.assertEditable(templateId);
    const node = this.findNode(nodes, nodeId);
    const ids = subtreeIds(toTreeNodes(nodes), nodeId);
    const byId = new Map(
      nodes.map((candidate) => [candidate.structure_template_node_id, candidate]),
    );
    const items = ids.map((id) => {
      const item = byId.get(id)!;
      return {
        id,
        parentId: item.parent_template_node_id,
        name: item.name,
        role: item.role,
      };
    });
    return {
      root: { id: nodeId, name: node.name, role: node.role },
      descendantCount: ids.length - 1,
      items,
    };
  }

  async deleteNode(
    templateId: number,
    nodeId: number,
    confirmed: boolean,
  ): Promise<void> {
    const preview = await this.deletionPreview(templateId, nodeId);
    if (preview.descendantCount > 0 && !confirmed) {
      throw ApiError.conflict(
        'SUBTREE_CONFIRMATION_REQUIRED',
        'Debe confirmar la eliminación del subárbol completo.',
        { preview },
      );
    }
    await this.repository.deleteNodes(preview.items.map((item) => item.id));
  }

  async activate(templateId: number): Promise<StructureTemplateDetail> {
    const nodes = await this.assertEditable(templateId);
    const roots = nodes.filter((node) => node.parent_template_node_id === null);
    const tree = toTreeNodes(nodes);
    const reachablePositions = nodes.filter(
      (node) =>
        node.role === 'POSITION' &&
        isNodePathEnabled(tree, node.structure_template_node_id),
    );
    const violations: Array<Record<string, unknown>> = [];
    if (roots.length !== 1) {
      violations.push({
        elementType: 'template',
        elementId: templateId,
        rule: 'REQUIRES_ONE_ROOT',
      });
    }
    if (reachablePositions.length === 0) {
      violations.push({
        elementType: 'template',
        elementId: templateId,
        rule: 'REQUIRES_REACHABLE_POSITION',
      });
    }
    if (violations.length > 0) {
      throw ApiError.invalid(
        'INVALID_TEMPLATE_TREE',
        'La plantilla no tiene una jerarquía utilizable.',
        { violations },
      );
    }
    await this.repository.update(templateId, { status: 'ACTIVE' });
    return this.detail(templateId);
  }

  async archive(templateId: number): Promise<StructureTemplateDetail> {
    const template = await this.assertTemplate(templateId);
    if (template.status !== 'ACTIVE') {
      throw ApiError.conflict(
        'INVALID_STATE_TRANSITION',
        'Solo una plantilla ACTIVE puede archivarse.',
      );
    }
    await this.repository.update(templateId, { status: 'ARCHIVED' });
    return this.detail(templateId);
  }

  private async assertTemplate(templateId: number): Promise<TemplateWithCreator> {
    const template = await this.repository.template(templateId);
    if (!template) {
      throw ApiError.notFound('TEMPLATE_NOT_FOUND', 'La plantilla no existe.');
    }
    return template;
  }

  private async assertEditable(templateId: number): Promise<StructureTemplateNodeRow[]> {
    const template = await this.assertTemplate(templateId);
    if (template.status !== 'DRAFT') {
      throw ApiError.conflict(
        'TEMPLATE_NOT_EDITABLE',
        'La jerarquía solo puede cambiar mientras la plantilla está en DRAFT.',
      );
    }
    return this.repository.nodes(templateId);
  }

  private findNode(
    nodes: StructureTemplateNodeRow[],
    nodeId: number,
  ): StructureTemplateNodeRow {
    const node = nodes.find(
      (candidate) => candidate.structure_template_node_id === nodeId,
    );
    if (!node) {
      throw ApiError.notFound(
        'TEMPLATE_NODE_NOT_FOUND',
        'El nodo no existe en la plantilla.',
      );
    }
    return node;
  }

  private validateParent(
    nodes: StructureTemplateNodeRow[],
    parentId: number | null,
    movingNodeId?: number,
  ): void {
    if (parentId === null) {
      const existingRoot = nodes.find(
        (node) =>
          node.parent_template_node_id === null &&
          node.structure_template_node_id !== movingNodeId,
      );
      if (existingRoot) {
        throw ApiError.invalid(
          'INVALID_PARENT',
          'La plantilla solo puede tener una raíz.',
        );
      }
      return;
    }
    const parent = this.findNode(nodes, parentId);
    if (parent.role === 'POSITION') {
      throw ApiError.invalid('INVALID_PARENT', 'Un nodo POSITION no puede tener hijas.');
    }
  }

  private validateDefaults(
    role: 'CONTAINER' | 'POSITION',
    defaults: CreateTemplateNodeDto['defaults'],
  ): void {
    if (role === 'CONTAINER' && defaults && hasDistributionValue(defaults)) {
      throw ApiError.invalid(
        'INVALID_DISTRIBUTION_SETTINGS',
        'Los defaults solo se permiten en nodos POSITION.',
      );
    }
  }
}

function toTemplate(row: TemplateWithCreator): StructureTemplate {
  return {
    structureTemplateId: row.structure_template_id,
    name: row.name,
    description: row.description,
    status: row.status,
    enabled: row.enabled,
    createdBy:
      row.created_by !== null && row.creator_username
        ? { userId: row.created_by, username: row.creator_username }
        : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function toNode(row: StructureTemplateNodeRow, children: TemplateNode[]): TemplateNode {
  const defaults = {
    capacity:
      row.default_capacity_value !== null && row.default_capacity_unit !== null
        ? { value: Number(row.default_capacity_value), unit: row.default_capacity_unit }
        : null,
    targetFillRatio:
      row.default_target_fill_ratio === null
        ? null
        : Number(row.default_target_fill_ratio),
    allowOverflow: row.default_allow_overflow,
  };
  return {
    structureTemplateNodeId: row.structure_template_node_id,
    parentTemplateNodeId: row.parent_template_node_id,
    name: row.name,
    role: row.role,
    position: row.sort_order,
    visualKind: row.visual_kind,
    enabled: row.enabled,
    defaults: hasDistributionValue(defaults) ? defaults : null,
    children,
  };
}

function buildNodeTree(rows: StructureTemplateNodeRow[]): TemplateNode[] {
  const children = new Map<number | null, StructureTemplateNodeRow[]>();
  for (const row of rows) {
    const group = children.get(row.parent_template_node_id) ?? [];
    group.push(row);
    children.set(row.parent_template_node_id, group);
  }
  for (const group of children.values())
    group.sort((a, b) => a.sort_order - b.sort_order);
  const build = (row: StructureTemplateNodeRow): TemplateNode =>
    toNode(row, (children.get(row.structure_template_node_id) ?? []).map(build));
  return (children.get(null) ?? []).map(build);
}

function defaultsToColumns(defaults: CreateTemplateNodeDto['defaults']) {
  return {
    default_capacity_value: defaults?.capacity?.value ?? null,
    default_capacity_unit: defaults?.capacity?.unit ?? null,
    default_target_fill_ratio: defaults?.targetFillRatio ?? null,
    default_allow_overflow: defaults?.allowOverflow ?? null,
  };
}

function hasDistributionValue(values: {
  capacity?: unknown;
  targetFillRatio?: unknown;
  allowOverflow?: unknown;
}): boolean {
  return (
    (values.capacity !== null && values.capacity !== undefined) ||
    (values.targetFillRatio !== null && values.targetFillRatio !== undefined) ||
    (values.allowOverflow !== null && values.allowOverflow !== undefined)
  );
}

function toTreeNodes(rows: StructureTemplateNodeRow[]) {
  return rows.map((row) => ({
    id: row.structure_template_node_id,
    parentId: row.parent_template_node_id,
    position: row.sort_order,
    role: row.role,
    enabled: row.enabled,
  }));
}

function isNodePathEnabled(
  nodes: ReturnType<typeof toTreeNodes>,
  nodeId: number,
): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let current = byId.get(nodeId);
  const visited = new Set<number>();
  while (current) {
    if (!current.enabled || visited.has(current.id)) return false;
    visited.add(current.id);
    if (current.parentId === null) return true;
    current = byId.get(current.parentId);
  }
  return false;
}
