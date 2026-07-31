import { Inject, Injectable } from '@nestjs/common';
import { sql, type Insertable, type Updateable } from 'kysely';

import { ApiError, translateDatabaseError } from '../common/api-error.js';
import { DATABASE, type Db } from '../database/database.module.js';
import type {
  CapacityUnit,
  LocationRole,
  LocationsTable,
  SchemeRow,
  SchemesTable,
  StructureTemplateStatus,
} from '../database/schema.types.js';
import type { Tx } from '../database/transaction.js';
import { deriveLeafSequence } from './structure-tree.js';

export type SchemeWithCreator = SchemeRow & { creator_username: string | null };

export interface LocationJoined {
  location_id: number;
  scheme_id: number;
  structure_template_id: number;
  structure_template_node_id: number;
  parent_location_id: number | null;
  name: string;
  sort_order: number;
  leaf_sequence: number | null;
  map_element_id: string | null;
  enabled: boolean;
  role: LocationRole;
  node_enabled: boolean;
  template_enabled: boolean;
  template_status: StructureTemplateStatus;
  capacity_value: string | null;
  capacity_unit: CapacityUnit | null;
  target_fill_ratio: string | null;
  allow_overflow: boolean | null;
  inherit_to_descendants: boolean | null;
  setting_updated_by: number | null;
  setting_updated_at: Date | null;
  setting_username: string | null;
}

export interface TemplateNodeForLocation {
  structure_template_node_id: number;
  structure_template_id: number;
  parent_template_node_id: number | null;
  role: LocationRole;
  enabled: boolean;
  template_status: StructureTemplateStatus;
  template_enabled: boolean;
}

@Injectable()
export class SchemesRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async list(options: {
    status?: 'DRAFT' | 'DEFINED' | 'DISTRIBUTED';
    enabled?: boolean;
    limit: number;
    offset: number;
  }): Promise<{ rows: SchemeWithCreator[]; total: number }> {
    let query = this.db
      .selectFrom('schemes')
      .leftJoin('users', 'users.user_id', 'schemes.created_by')
      .selectAll('schemes')
      .select('users.username as creator_username');
    let countQuery = this.db
      .selectFrom('schemes')
      .select((eb) => eb.fn.countAll<number>().as('count'));
    if (options.status) {
      query = query.where('schemes.status', '=', options.status);
      countQuery = countQuery.where('status', '=', options.status);
    }
    if (options.enabled !== undefined) {
      query = query.where('schemes.enabled', '=', options.enabled);
      countQuery = countQuery.where('enabled', '=', options.enabled);
    }
    const [rows, count] = await Promise.all([
      query
        .orderBy('schemes.updated_at', 'desc')
        .orderBy('schemes.scheme_id', 'desc')
        .limit(options.limit)
        .offset(options.offset)
        .execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);
    return { rows, total: Number(count.count) };
  }

  scheme(schemeId: number): Promise<SchemeWithCreator | undefined> {
    return this.db
      .selectFrom('schemes')
      .leftJoin('users', 'users.user_id', 'schemes.created_by')
      .selectAll('schemes')
      .select('users.username as creator_username')
      .where('schemes.scheme_id', '=', schemeId)
      .executeTakeFirst();
  }

  async locations(schemeId: number): Promise<LocationJoined[]> {
    const rows = await this.db
      .selectFrom('locations as l')
      .innerJoin('structure_template_nodes as n', (join) =>
        join
          .onRef('n.structure_template_node_id', '=', 'l.structure_template_node_id')
          .onRef('n.structure_template_id', '=', 'l.structure_template_id'),
      )
      .innerJoin(
        'structure_templates as t',
        't.structure_template_id',
        'l.structure_template_id',
      )
      .leftJoin('location_distribution_settings as s', (join) =>
        join
          .onRef('s.location_id', '=', 'l.location_id')
          .onRef('s.scheme_id', '=', 'l.scheme_id'),
      )
      .leftJoin('users as su', 'su.user_id', 's.updated_by')
      .selectAll('l')
      .select([
        'n.role as role',
        'n.enabled as node_enabled',
        't.enabled as template_enabled',
        't.status as template_status',
        's.capacity_value as capacity_value',
        's.capacity_unit as capacity_unit',
        's.target_fill_ratio as target_fill_ratio',
        's.allow_overflow as allow_overflow',
        's.inherit_to_descendants as inherit_to_descendants',
        's.updated_by as setting_updated_by',
        's.updated_at as setting_updated_at',
        'su.username as setting_username',
      ])
      .where('l.scheme_id', '=', schemeId)
      .orderBy('l.sort_order', 'asc')
      .orderBy('l.location_id', 'asc')
      .execute();
    return rows as unknown as LocationJoined[];
  }

  async templateNode(
    templateId: number,
    nodeId: number,
  ): Promise<TemplateNodeForLocation | undefined> {
    return this.db
      .selectFrom('structure_template_nodes as n')
      .innerJoin(
        'structure_templates as t',
        't.structure_template_id',
        'n.structure_template_id',
      )
      .select([
        'n.structure_template_node_id',
        'n.structure_template_id',
        'n.parent_template_node_id',
        'n.role',
        'n.enabled',
        't.status as template_status',
        't.enabled as template_enabled',
      ])
      .where('n.structure_template_id', '=', templateId)
      .where('n.structure_template_node_id', '=', nodeId)
      .executeTakeFirst();
  }

  async templatePathEnabled(templateId: number, nodeId: number): Promise<boolean> {
    const nodes = await this.db
      .selectFrom('structure_template_nodes')
      .select(['structure_template_node_id', 'parent_template_node_id', 'enabled'])
      .where('structure_template_id', '=', templateId)
      .execute();
    const byId = new Map(nodes.map((node) => [node.structure_template_node_id, node]));
    let current = byId.get(nodeId);
    const visited = new Set<number>();
    while (current) {
      if (!current.enabled || visited.has(current.structure_template_node_id))
        return false;
      visited.add(current.structure_template_node_id);
      if (current.parent_template_node_id === null) return true;
      current = byId.get(current.parent_template_node_id);
    }
    return false;
  }

  async create(values: Insertable<SchemesTable>): Promise<SchemeRow> {
    return this.translated(() =>
      this.db
        .insertInto('schemes')
        .values(values)
        .returningAll()
        .executeTakeFirstOrThrow(),
    );
  }

  async update(schemeId: number, values: Updateable<SchemesTable>): Promise<void> {
    await this.translated(() =>
      this.db
        .updateTable('schemes')
        .set({ ...values, updated_at: new Date() })
        .where('scheme_id', '=', schemeId)
        .execute(),
    );
  }

  async createLocation(
    schemeId: number,
    values: Omit<Insertable<LocationsTable>, 'scheme_id'>,
    requestedPosition?: number,
  ) {
    return this.translated(() =>
      this.db.transaction().execute(async (tx) => {
        const parentId = values.parent_location_id ?? null;
        const siblings = await this.siblingIds(tx, schemeId, parentId);
        const created = await tx
          .insertInto('locations')
          .values({ ...values, scheme_id: schemeId, sort_order: siblings.length })
          .returningAll()
          .executeTakeFirstOrThrow();
        siblings.splice(
          Math.min(requestedPosition ?? siblings.length, siblings.length),
          0,
          created.location_id,
        );
        await this.writeOrder(tx, siblings);
        return created;
      }),
    );
  }

  async updateLocation(
    locationId: number,
    values: Updateable<LocationsTable>,
  ): Promise<void> {
    await this.translated(() =>
      this.db
        .updateTable('locations')
        .set({ ...values, updated_at: new Date() })
        .where('location_id', '=', locationId)
        .execute(),
    );
  }

  async moveLocation(
    schemeId: number,
    locationId: number,
    parentId: number | null,
    position: number,
  ): Promise<void> {
    await this.translated(() =>
      this.db.transaction().execute(async (tx) => {
        const current = await tx
          .selectFrom('locations')
          .select('parent_location_id')
          .where('scheme_id', '=', schemeId)
          .where('location_id', '=', locationId)
          .executeTakeFirstOrThrow();
        const oldParent = current.parent_location_id;
        const target = (await this.siblingIds(tx, schemeId, parentId)).filter(
          (id) => id !== locationId,
        );
        await tx
          .updateTable('locations')
          .set({
            parent_location_id: parentId,
            sort_order: -locationId,
            updated_at: new Date(),
          })
          .where('location_id', '=', locationId)
          .execute();
        if (oldParent !== parentId) {
          await this.writeOrder(
            tx,
            (await this.siblingIds(tx, schemeId, oldParent)).filter(
              (id) => id !== locationId,
            ),
          );
        }
        target.splice(Math.min(position, target.length), 0, locationId);
        await this.writeOrder(tx, target);
      }),
    );
  }

  async orderLocations(ids: number[]): Promise<void> {
    await this.translated(() =>
      this.db.transaction().execute((tx) => this.writeOrder(tx, ids)),
    );
  }

  async deleteLocations(idsDepthFirst: number[]): Promise<void> {
    await this.translated(() =>
      this.db.transaction().execute(async (tx) => {
        for (const id of [...idsDepthFirst].reverse()) {
          await tx.deleteFrom('locations').where('location_id', '=', id).execute();
        }
      }),
    );
  }

  async define(schemeId: number): Promise<number> {
    return this.translated(() =>
      this.db.transaction().execute(async (tx) => {
        const scheme = await tx
          .selectFrom('schemes')
          .select(['scheme_id', 'status'])
          .where('scheme_id', '=', schemeId)
          .forUpdate()
          .executeTakeFirst();
        if (!scheme) throw ApiError.notFound('SCHEME_NOT_FOUND', 'El scheme no existe.');
        if (scheme.status !== 'DRAFT') {
          throw ApiError.conflict(
            'INVALID_STATE_TRANSITION',
            'Solo un scheme DRAFT puede definirse.',
          );
        }

        const rows = await tx
          .selectFrom('locations as l')
          .innerJoin('structure_template_nodes as n', (join) =>
            join
              .onRef('n.structure_template_node_id', '=', 'l.structure_template_node_id')
              .onRef('n.structure_template_id', '=', 'l.structure_template_id'),
          )
          .innerJoin(
            'structure_templates as t',
            't.structure_template_id',
            'l.structure_template_id',
          )
          .select([
            'l.location_id',
            'l.parent_location_id',
            'l.sort_order',
            'l.enabled',
            'n.role',
            'n.enabled as node_enabled',
            't.enabled as template_enabled',
            't.status as template_status',
          ])
          .where('l.scheme_id', '=', schemeId)
          .execute();
        const sequence = deriveLeafSequence(
          rows.map((row) => ({
            id: row.location_id,
            parentId: row.parent_location_id,
            position: row.sort_order,
            role: row.role,
            enabled:
              row.enabled &&
              row.node_enabled &&
              row.template_enabled &&
              (row.template_status === 'ACTIVE' || row.template_status === 'ARCHIVED'),
          })),
        );
        const assignments = [...sequence].filter(
          (entry): entry is [number, number] => entry[1] !== null,
        );
        if (assignments.length === 0) {
          throw ApiError.invalid(
            'INVALID_SCHEME_TREE',
            'El scheme requiere al menos una POSITION utilizable.',
          );
        }

        await tx
          .updateTable('locations')
          .set({ leaf_sequence: null })
          .where('scheme_id', '=', schemeId)
          .execute();
        const values = sql.join(
          assignments.map(([id, value]) => sql`(${id}::integer, ${value}::integer)`),
          sql`, `,
        );
        await sql`
          UPDATE locations AS location
          SET leaf_sequence = assigned.sequence
          FROM (VALUES ${values}) AS assigned(location_id, sequence)
          WHERE location.location_id = assigned.location_id
            AND location.scheme_id = ${schemeId}
        `.execute(tx);
        await tx
          .updateTable('schemes')
          .set({ status: 'DEFINED', updated_at: new Date() })
          .where('scheme_id', '=', schemeId)
          .execute();
        return assignments.length;
      }),
    );
  }

  async replaceSettings(
    schemeId: number,
    locationId: number,
    values: {
      capacityValue: number | null;
      capacityUnit: CapacityUnit | null;
      targetFillRatio: number | null;
      allowOverflow: boolean | null;
      inheritToDescendants: boolean;
      updatedBy: number | null;
    },
  ): Promise<void> {
    await this.translated(() =>
      this.db.transaction().execute(async (tx) => {
        await tx
          .insertInto('location_distribution_settings')
          .values({
            scheme_id: schemeId,
            location_id: locationId,
            capacity_value: values.capacityValue,
            capacity_unit: values.capacityUnit,
            target_fill_ratio: values.targetFillRatio,
            allow_overflow: values.allowOverflow,
            inherit_to_descendants: values.inheritToDescendants,
            updated_by: values.updatedBy,
          })
          .onConflict((conflict) =>
            conflict.column('location_id').doUpdateSet({
              scheme_id: schemeId,
              capacity_value: values.capacityValue,
              capacity_unit: values.capacityUnit,
              target_fill_ratio: values.targetFillRatio,
              allow_overflow: values.allowOverflow,
              inherit_to_descendants: values.inheritToDescendants,
              updated_by: values.updatedBy,
              updated_at: new Date(),
            }),
          )
          .execute();
      }),
    );
  }

  async copy(
    sourceSchemeId: number,
    values: { name: string; description: string | null; createdBy: number | null },
  ): Promise<{ schemeId: number; locations: number }> {
    return this.translated(() =>
      this.db.transaction().execute(async (tx) => {
        const source = await tx
          .selectFrom('schemes')
          .select('scheme_id')
          .where('scheme_id', '=', sourceSchemeId)
          .forShare()
          .executeTakeFirst();
        if (!source) throw ApiError.notFound('SCHEME_NOT_FOUND', 'El scheme no existe.');

        const copy = await tx
          .insertInto('schemes')
          .values({
            name: values.name,
            description: values.description,
            status: 'DRAFT',
            enabled: true,
            is_active: false,
            based_on_scheme_id: sourceSchemeId,
            created_by: values.createdBy,
          })
          .returning('scheme_id')
          .executeTakeFirstOrThrow();
        const sourceLocations = await tx
          .selectFrom('locations')
          .selectAll()
          .where('scheme_id', '=', sourceSchemeId)
          .orderBy('location_id', 'asc')
          .execute();
        const pending = [...sourceLocations];
        const ids = new Map<number, number>();

        while (pending.length > 0) {
          let copiedThisPass = 0;
          for (let index = pending.length - 1; index >= 0; index -= 1) {
            const sourceLocation = pending[index]!;
            const parentId = sourceLocation.parent_location_id;
            if (parentId !== null && !ids.has(parentId)) continue;
            const inserted = await tx
              .insertInto('locations')
              .values({
                scheme_id: copy.scheme_id,
                structure_template_id: sourceLocation.structure_template_id,
                structure_template_node_id: sourceLocation.structure_template_node_id,
                parent_location_id: parentId === null ? null : ids.get(parentId)!,
                name: sourceLocation.name,
                sort_order: sourceLocation.sort_order,
                leaf_sequence: null,
                map_element_id: sourceLocation.map_element_id,
                enabled: sourceLocation.enabled,
              })
              .returning('location_id')
              .executeTakeFirstOrThrow();
            ids.set(sourceLocation.location_id, inserted.location_id);
            pending.splice(index, 1);
            copiedThisPass += 1;
          }
          if (copiedThisPass === 0) {
            throw ApiError.invalid(
              'INVALID_SCHEME_TREE',
              'El árbol de origen no tiene un linaje de locations válido.',
            );
          }
        }

        const settings = await tx
          .selectFrom('location_distribution_settings')
          .selectAll()
          .where('scheme_id', '=', sourceSchemeId)
          .execute();
        if (settings.length > 0) {
          await tx
            .insertInto('location_distribution_settings')
            .values(
              settings.map((setting) => ({
                scheme_id: copy.scheme_id,
                location_id: ids.get(setting.location_id)!,
                capacity_value: setting.capacity_value,
                capacity_unit: setting.capacity_unit,
                target_fill_ratio: setting.target_fill_ratio,
                allow_overflow: setting.allow_overflow,
                inherit_to_descendants: setting.inherit_to_descendants,
                // PA-003: se conserva provisionalmente la autoría del valor vigente.
                updated_by: setting.updated_by,
              })),
            )
            .execute();
        }
        return { schemeId: copy.scheme_id, locations: ids.size };
      }),
    );
  }

  async deleteSettings(schemeId: number, locationId: number): Promise<void> {
    await this.db
      .deleteFrom('location_distribution_settings')
      .where('scheme_id', '=', schemeId)
      .where('location_id', '=', locationId)
      .execute();
  }

  private async siblingIds(
    tx: Tx,
    schemeId: number,
    parentId: number | null,
  ): Promise<number[]> {
    const rows = await tx
      .selectFrom('locations')
      .select('location_id')
      .where('scheme_id', '=', schemeId)
      .where('parent_location_id', parentId === null ? 'is' : '=', parentId)
      .orderBy('sort_order', 'asc')
      .execute();
    return rows.map((row) => row.location_id);
  }

  private async writeOrder(tx: Tx, ids: number[]): Promise<void> {
    for (const id of ids) {
      await tx
        .updateTable('locations')
        .set({ sort_order: -id })
        .where('location_id', '=', id)
        .execute();
    }
    for (const [position, id] of ids.entries()) {
      await tx
        .updateTable('locations')
        .set({ sort_order: position, updated_at: new Date() })
        .where('location_id', '=', id)
        .execute();
    }
  }

  private async translated<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      const translated = translateDatabaseError(error);
      if (translated) throw translated;
      throw error;
    }
  }
}
