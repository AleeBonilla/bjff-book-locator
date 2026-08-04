import { Inject, Injectable } from '@nestjs/common';
import { sql, type Transaction } from 'kysely';

import { ApiError } from '../common/api-error.js';
import { DATABASE, type Db } from '../database/database.module.js';
import type {
  CapacityUnit,
  Database,
  DistributionStrategy,
  DistributionRunRow,
  ProcessStatus,
  RangeSource,
} from '../database/schema.types.js';
import type {
  CalculatedPlacement,
  CalculatedRange,
  DistributionBook,
  NormalizedAnchor,
} from './distribution-engine.js';
import type { ResolvedPosition } from './effective-configuration.js';

export type DistributionRunJoined = DistributionRunRow & {
  creator_username: string | null;
};

export interface PositionJoined {
  location_id: number;
  position_sequence: number;
  capacity_value: string | null;
  capacity_unit: 'BOOKS' | 'CENTIMETERS' | 'WEIGHT' | null;
  target_fill_ratio: string;
  allow_overflow: boolean;
  resolution: Record<string, unknown>;
  path: string;
}

export interface AnchorJoined {
  location_id: number;
  boundary_code: string;
  boundary_key: string;
  path: string;
}

export interface RangeJoined {
  distribution_range_id: number;
  location_id: number;
  range_sequence: number;
  range_start_key: string;
  range_end_key: string;
  range_start_code: string | null;
  range_end_code: string | null;
  source: 'AUTO' | 'ANCHORED' | 'MANUAL';
  book_count: number;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  reviewer_username: string | null;
  path: string;
}

export interface ConfigurationRow {
  location_id: number;
  parent_location_id: number | null;
  structure_template_node_id: number;
  leaf_sequence: number | null;
  location_enabled: boolean;
  node_enabled: boolean;
  template_enabled: boolean;
  role: 'CONTAINER' | 'POSITION';
  capacity_value: string | null;
  capacity_unit: CapacityUnit | null;
  target_fill_ratio: string | null;
  allow_overflow: boolean | null;
  inherit_to_descendants: boolean | null;
  default_capacity_value: string | null;
  default_capacity_unit: CapacityUnit | null;
  default_target_fill_ratio: string | null;
  default_allow_overflow: boolean | null;
}

export interface SearchLocationRow {
  path: string;
  mapElementId: string | null;
  sequence: number;
}

@Injectable()
export class DistributionRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async list(options: {
    schemeId?: number;
    status?: ProcessStatus;
    limit: number;
    offset: number;
  }): Promise<{ rows: DistributionRunJoined[]; total: number }> {
    let rowsQuery = this.db
      .selectFrom('distribution_runs as r')
      .leftJoin('users as u', 'u.user_id', 'r.created_by')
      .selectAll('r')
      .select('u.username as creator_username');
    let countQuery = this.db
      .selectFrom('distribution_runs')
      .select((eb) => eb.fn.countAll<number>().as('count'));

    if (options.schemeId !== undefined) {
      rowsQuery = rowsQuery.where('r.scheme_id', '=', options.schemeId);
      countQuery = countQuery.where('scheme_id', '=', options.schemeId);
    }
    if (options.status !== undefined) {
      rowsQuery = rowsQuery.where('r.status', '=', options.status);
      countQuery = countQuery.where('status', '=', options.status);
    }

    const [rows, count] = await Promise.all([
      rowsQuery
        .orderBy('r.created_at', 'desc')
        .orderBy('r.distribution_run_id', 'desc')
        .limit(options.limit)
        .offset(options.offset)
        .execute(),
      countQuery.executeTakeFirstOrThrow(),
    ]);
    return { rows, total: Number(count.count) };
  }

  run(runId: number): Promise<DistributionRunJoined | undefined> {
    return this.db
      .selectFrom('distribution_runs as r')
      .leftJoin('users as u', 'u.user_id', 'r.created_by')
      .selectAll('r')
      .select('u.username as creator_username')
      .where('r.distribution_run_id', '=', runId)
      .executeTakeFirst();
  }

  schemeForCalculation(schemeId: number) {
    return this.db
      .selectFrom('schemes')
      .select(['scheme_id', 'status', 'enabled'])
      .where('scheme_id', '=', schemeId)
      .executeTakeFirst();
  }

  loadForCalculation(loadId: number) {
    return this.db
      .selectFrom('collection_loads')
      .select(['collection_load_id', 'status'])
      .where('collection_load_id', '=', loadId)
      .executeTakeFirst();
  }

  configurationRows(schemeId: number): Promise<ConfigurationRow[]> {
    return this.db
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
      .select([
        'l.location_id',
        'l.parent_location_id',
        'l.structure_template_node_id',
        'l.leaf_sequence',
        'l.enabled as location_enabled',
        'n.enabled as node_enabled',
        't.enabled as template_enabled',
        'n.role',
        's.capacity_value',
        's.capacity_unit',
        's.target_fill_ratio',
        's.allow_overflow',
        's.inherit_to_descendants',
        'n.default_capacity_value',
        'n.default_capacity_unit',
        'n.default_target_fill_ratio',
        'n.default_allow_overflow',
      ])
      .where('l.scheme_id', '=', schemeId)
      .orderBy('l.leaf_sequence', 'asc')
      .execute() as Promise<ConfigurationRow[]>;
  }

  async booksForCalculation(loadId: number): Promise<DistributionBook[]> {
    const rows = await this.db
      .selectFrom('books')
      .select(['book_id', 'comparable_key', 'classification_raw'])
      .where('collection_load_id', '=', loadId)
      .orderBy(sql`comparable_key COLLATE "C"`, 'asc')
      .orderBy('book_id', 'asc')
      .execute();
    return rows.map((row) => ({
      bookId: row.book_id,
      comparableKey: row.comparable_key,
      classificationCode: row.classification_raw,
    }));
  }

  async createPending(values: {
    schemeId: number;
    collectionLoadId: number;
    basedOnDistributionRunId: number | null;
    strategy: DistributionStrategy;
    parameters: Record<string, unknown>;
    defaultCapacityValue: number | null;
    defaultCapacityUnit: CapacityUnit | null;
    defaultTargetFillRatio: number;
    defaultAllowOverflow: boolean;
    createdBy: number | null;
  }): Promise<number> {
    const row = await this.db
      .insertInto('distribution_runs')
      .values({
        scheme_id: values.schemeId,
        collection_load_id: values.collectionLoadId,
        based_on_distribution_run_id: values.basedOnDistributionRunId,
        strategy: values.strategy,
        parameters: values.parameters,
        status: 'PENDING',
        default_capacity_value: values.defaultCapacityValue,
        default_capacity_unit: values.defaultCapacityUnit,
        default_target_fill_ratio: values.defaultTargetFillRatio,
        default_allow_overflow: values.defaultAllowOverflow,
        created_by: values.createdBy,
        error_message: null,
        finished_at: null,
      })
      .returning('distribution_run_id')
      .executeTakeFirstOrThrow();
    return row.distribution_run_id;
  }

  async saveInitialCalculation(
    runId: number,
    schemeId: number,
    loadId: number,
    createdBy: number | null,
    positions: ResolvedPosition[],
    anchors: NormalizedAnchor[],
    result: {
      placements: CalculatedPlacement[];
      ranges: CalculatedRange[];
      unassignedBookIds: number[];
    },
    bookCount: number,
  ): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      const run = await this.lockRun(tx, runId);
      if (run.status !== 'PENDING') {
        throw ApiError.conflict('INVALID_RUN_STATE', 'La corrida no está pendiente.');
      }
      await tx
        .insertInto('distribution_position_inputs')
        .values(
          positions.map((position) => ({
            distribution_run_id: runId,
            scheme_id: schemeId,
            location_id: position.locationId,
            position_sequence: position.positionSequence,
            capacity_value: position.capacity?.value ?? null,
            capacity_unit: position.capacity?.unit ?? null,
            target_fill_ratio: position.targetFillRatio,
            allow_overflow: position.allowOverflow,
            resolution: position.resolution,
          })),
        )
        .execute();
      if (anchors.length > 0) {
        await tx
          .insertInto('distribution_anchors')
          .values(
            anchors.map((anchor) => ({
              distribution_run_id: runId,
              scheme_id: schemeId,
              location_id: anchor.locationId,
              boundary_key: anchor.boundaryKey,
              boundary_code: anchor.boundaryCode,
              created_by: createdBy,
            })),
          )
          .execute();
      }
      if (result.ranges.length > 0) {
        await tx
          .insertInto('distribution_ranges')
          .values(
            result.ranges.map((range) => ({
              distribution_run_id: runId,
              scheme_id: schemeId,
              location_id: range.locationId,
              range_sequence: range.rangeSequence,
              range_start_key: range.rangeStartKey,
              range_end_key: range.rangeEndKey,
              range_start_code: range.rangeStartCode,
              range_end_code: range.rangeEndCode,
              source: range.source,
              book_count: range.bookCount,
              reviewed_by: null,
              reviewed_at: null,
              review_notes: null,
            })),
          )
          .execute();
      }
      if (result.placements.length > 0) {
        await tx
          .insertInto('book_placements')
          .values(
            result.placements.map((placement) => ({
              distribution_run_id: runId,
              scheme_id: schemeId,
              collection_load_id: loadId,
              book_id: placement.bookId,
              location_id: placement.locationId,
              source: placement.source as RangeSource,
            })),
          )
          .execute();
      }
      await tx
        .updateTable('distribution_runs')
        .set({
          status: 'DONE',
          book_count: bookCount,
          position_count: positions.length,
          unassigned_count: result.unassignedBookIds.length,
          error_message: null,
          finished_at: new Date(),
        })
        .where('distribution_run_id', '=', runId)
        .execute();
      await tx
        .updateTable('schemes')
        .set({ status: 'DISTRIBUTED', updated_at: new Date() })
        .where('scheme_id', '=', schemeId)
        .where('status', '=', 'DEFINED')
        .execute();
    });
  }

  async markInitialError(runId: number, diagnostic: string): Promise<void> {
    await this.db
      .updateTable('distribution_runs')
      .set({
        status: 'ERROR',
        error_message: diagnostic,
        finished_at: new Date(),
        book_count: 0,
        position_count: 0,
        unassigned_count: 0,
      })
      .where('distribution_run_id', '=', runId)
      .execute();
  }

  async replaceCalculation(values: {
    runId: number;
    expectedRevision: number;
    defaults: {
      capacity: { value: number; unit: CapacityUnit } | null;
      targetFillRatio: number;
      allowOverflow: boolean;
    };
    createdBy: number | null;
    positions: ResolvedPosition[];
    anchors: NormalizedAnchor[];
    result: {
      placements: CalculatedPlacement[];
      ranges: CalculatedRange[];
      unassignedBookIds: number[];
    };
    bookCount: number;
  }): Promise<number> {
    return this.db.transaction().execute(async (tx) => {
      const run = await this.lockRun(tx, values.runId);
      this.assertReplaceable(run, values.expectedRevision);

      await tx
        .deleteFrom('book_placements')
        .where('distribution_run_id', '=', values.runId)
        .execute();
      await tx
        .deleteFrom('distribution_ranges')
        .where('distribution_run_id', '=', values.runId)
        .execute();
      await tx
        .deleteFrom('distribution_anchors')
        .where('distribution_run_id', '=', values.runId)
        .execute();
      await tx
        .deleteFrom('distribution_position_inputs')
        .where('distribution_run_id', '=', values.runId)
        .execute();

      await tx
        .insertInto('distribution_position_inputs')
        .values(
          values.positions.map((position) => ({
            distribution_run_id: values.runId,
            scheme_id: run.scheme_id,
            location_id: position.locationId,
            position_sequence: position.positionSequence,
            capacity_value: position.capacity?.value ?? null,
            capacity_unit: position.capacity?.unit ?? null,
            target_fill_ratio: position.targetFillRatio,
            allow_overflow: position.allowOverflow,
            resolution: position.resolution,
          })),
        )
        .execute();
      if (values.anchors.length > 0) {
        await tx
          .insertInto('distribution_anchors')
          .values(
            values.anchors.map((anchor) => ({
              distribution_run_id: values.runId,
              scheme_id: run.scheme_id,
              location_id: anchor.locationId,
              boundary_key: anchor.boundaryKey,
              boundary_code: anchor.boundaryCode,
              created_by: values.createdBy,
            })),
          )
          .execute();
      }
      if (values.result.ranges.length > 0) {
        await tx
          .insertInto('distribution_ranges')
          .values(
            values.result.ranges.map((range) => ({
              distribution_run_id: values.runId,
              scheme_id: run.scheme_id,
              location_id: range.locationId,
              range_sequence: range.rangeSequence,
              range_start_key: range.rangeStartKey,
              range_end_key: range.rangeEndKey,
              range_start_code: range.rangeStartCode,
              range_end_code: range.rangeEndCode,
              source: range.source,
              book_count: range.bookCount,
              reviewed_by: null,
              reviewed_at: null,
              review_notes: null,
            })),
          )
          .execute();
      }
      if (values.result.placements.length > 0) {
        await tx
          .insertInto('book_placements')
          .values(
            values.result.placements.map((placement) => ({
              distribution_run_id: values.runId,
              scheme_id: run.scheme_id,
              collection_load_id: run.collection_load_id,
              book_id: placement.bookId,
              location_id: placement.locationId,
              source: placement.source,
            })),
          )
          .execute();
      }

      const revision = run.revision + 1;
      await tx
        .updateTable('distribution_runs')
        .set({
          status: 'DONE',
          default_capacity_value: values.defaults.capacity?.value ?? null,
          default_capacity_unit: values.defaults.capacity?.unit ?? null,
          default_target_fill_ratio: values.defaults.targetFillRatio,
          default_allow_overflow: values.defaults.allowOverflow,
          book_count: values.bookCount,
          position_count: values.positions.length,
          unassigned_count: values.result.unassignedBookIds.length,
          error_message: null,
          finished_at: new Date(),
          revision,
        })
        .where('distribution_run_id', '=', values.runId)
        .execute();
      return revision;
    });
  }

  async markRetryError(
    runId: number,
    expectedRevision: number,
    diagnostic: string,
  ): Promise<number> {
    return this.db.transaction().execute(async (tx) => {
      const run = await this.lockRun(tx, runId);
      this.assertReplaceable(run, expectedRevision);
      if (run.status !== 'ERROR') {
        return run.revision;
      }
      await tx
        .deleteFrom('book_placements')
        .where('distribution_run_id', '=', runId)
        .execute();
      await tx
        .deleteFrom('distribution_ranges')
        .where('distribution_run_id', '=', runId)
        .execute();
      await tx
        .deleteFrom('distribution_anchors')
        .where('distribution_run_id', '=', runId)
        .execute();
      await tx
        .deleteFrom('distribution_position_inputs')
        .where('distribution_run_id', '=', runId)
        .execute();
      const revision = run.revision + 1;
      await tx
        .updateTable('distribution_runs')
        .set({
          status: 'ERROR',
          error_message: diagnostic,
          finished_at: new Date(),
          book_count: 0,
          position_count: 0,
          unassigned_count: 0,
          revision,
        })
        .where('distribution_run_id', '=', runId)
        .execute();
      return revision;
    });
  }

  async reviewRange(values: {
    runId: number;
    rangeId: number;
    expectedRevision: number;
    notes: string | null;
    reviewedBy: number | null;
  }): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      const run = await this.lockRun(tx, values.runId);
      this.assertReplaceable(run, values.expectedRevision);
      if (run.status !== 'DONE') {
        throw ApiError.conflict(
          'INVALID_RUN_STATE',
          'Solo se pueden revisar rangos de una corrida terminada.',
        );
      }
      const range = await tx
        .selectFrom('distribution_ranges')
        .select('distribution_range_id')
        .where('distribution_range_id', '=', values.rangeId)
        .where('distribution_run_id', '=', values.runId)
        .executeTakeFirst();
      if (!range) {
        throw ApiError.notFound(
          'DISTRIBUTION_RANGE_NOT_FOUND',
          'El rango no pertenece a la corrida.',
        );
      }
      await tx
        .updateTable('distribution_ranges')
        .set({
          review_notes: values.notes,
          reviewed_by: values.notes === null ? null : values.reviewedBy,
          reviewed_at: values.notes === null ? null : new Date(),
        })
        .where('distribution_range_id', '=', values.rangeId)
        .execute();
      await tx
        .updateTable('distribution_runs')
        .set({ revision: run.revision + 1 })
        .where('distribution_run_id', '=', values.runId)
        .execute();
    });
  }

  async publish(
    runId: number,
    expectedRevision: number,
    previewAccepted: boolean,
    unassignedAccepted: boolean,
  ): Promise<void> {
    await this.db.transaction().execute(async (tx) => {
      const run = await this.lockRun(tx, runId);
      if (run.revision !== expectedRevision) {
        throw ApiError.conflict(
          'RUN_VERSION_CONFLICT',
          'La corrida cambió. Refrescá la vista antes de publicar.',
          { currentRevision: run.revision },
        );
      }
      if (run.status !== 'DONE' || !previewAccepted) {
        throw ApiError.conflict(
          'INVALID_RUN_STATE',
          'Solo una vista previa terminada y aceptada puede publicarse.',
        );
      }
      if (run.unassigned_count > 0 && !unassignedAccepted) {
        throw ApiError.conflict(
          'UNASSIGNED_CONFIRMATION_REQUIRED',
          'Confirmá por separado los registros sin asignar.',
          { unassignedCount: run.unassigned_count },
        );
      }

      await tx
        .selectFrom('schemes')
        .select('scheme_id')
        .where((eb) =>
          eb.or([eb('scheme_id', '=', run.scheme_id), eb('is_active', '=', true)]),
        )
        .orderBy('scheme_id')
        .forUpdate()
        .execute();
      const scheme = await tx
        .selectFrom('schemes')
        .select(['status', 'enabled'])
        .where('scheme_id', '=', run.scheme_id)
        .executeTakeFirst();
      if (!scheme || scheme.status !== 'DISTRIBUTED' || !scheme.enabled) {
        throw ApiError.conflict(
          'INVALID_RUN_STATE',
          'El scheme no está disponible para publicar.',
        );
      }

      const previous = await tx
        .selectFrom('distribution_runs')
        .select(['distribution_run_id', 'revision'])
        .where('scheme_id', '=', run.scheme_id)
        .where('is_published', '=', true)
        .where('distribution_run_id', '!=', runId)
        .forUpdate()
        .execute();

      await tx
        .updateTable('schemes')
        .set({ is_active: false })
        .where('is_active', '=', true)
        .execute();
      for (const old of previous) {
        await tx
          .updateTable('distribution_runs')
          .set({ is_published: false, revision: old.revision + 1 })
          .where('distribution_run_id', '=', old.distribution_run_id)
          .execute();
      }
      await tx
        .updateTable('distribution_runs')
        .set({
          is_published: true,
          published_at: new Date(),
          revision: run.revision + 1,
        })
        .where('distribution_run_id', '=', runId)
        .execute();
      await tx
        .updateTable('schemes')
        .set({ is_active: true, updated_at: new Date() })
        .where('scheme_id', '=', run.scheme_id)
        .execute();
    });
  }

  async publicExact(key: string): Promise<{
    distributionAvailable: boolean;
    exactExists: boolean;
    locations: SearchLocationRow[];
  }> {
    const published = await this.publicRun();
    if (!published) {
      return { distributionAvailable: false, exactExists: false, locations: [] };
    }
    const exact = await this.db
      .selectFrom('books')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('collection_load_id', '=', published.collectionLoadId)
      .where('comparable_key', '=', key)
      .executeTakeFirstOrThrow();
    if (Number(exact.count) === 0) {
      return { distributionAvailable: true, exactExists: false, locations: [] };
    }
    const locations = await this.db
      .selectFrom('books as b')
      .innerJoin('book_placements as bp', (join) =>
        join
          .onRef('bp.book_id', '=', 'b.book_id')
          .onRef('bp.collection_load_id', '=', 'b.collection_load_id'),
      )
      .innerJoin('distribution_position_inputs as p', (join) =>
        join
          .onRef('p.distribution_run_id', '=', 'bp.distribution_run_id')
          .onRef('p.location_id', '=', 'bp.location_id'),
      )
      .innerJoin('location_paths as lp', (join) =>
        join
          .onRef('lp.location_id', '=', 'bp.location_id')
          .onRef('lp.scheme_id', '=', 'bp.scheme_id'),
      )
      .innerJoin('locations as l', 'l.location_id', 'bp.location_id')
      .select([
        'lp.path',
        'l.map_element_id as mapElementId',
        'p.position_sequence as sequence',
      ])
      .where('bp.distribution_run_id', '=', published.runId)
      .where('b.collection_load_id', '=', published.collectionLoadId)
      .where('b.comparable_key', '=', key)
      .orderBy('p.position_sequence')
      .execute();
    return {
      distributionAvailable: true,
      exactExists: true,
      locations,
    };
  }

  async publicRange(key: string): Promise<SearchLocationRow[]> {
    const published = await this.publicRun();
    if (!published) return [];
    return this.db
      .selectFrom('distribution_ranges as r')
      .innerJoin('distribution_position_inputs as p', (join) =>
        join
          .onRef('p.distribution_run_id', '=', 'r.distribution_run_id')
          .onRef('p.location_id', '=', 'r.location_id'),
      )
      .innerJoin('location_paths as lp', (join) =>
        join
          .onRef('lp.location_id', '=', 'r.location_id')
          .onRef('lp.scheme_id', '=', 'r.scheme_id'),
      )
      .innerJoin('locations as l', 'l.location_id', 'r.location_id')
      .select([
        'lp.path',
        'l.map_element_id as mapElementId',
        'p.position_sequence as sequence',
      ])
      .where('r.distribution_run_id', '=', published.runId)
      .where('r.range_start_key', '<=', key)
      .where('r.range_end_key', '>', key)
      .orderBy('p.position_sequence')
      .execute();
  }

  private async publicRun(): Promise<{
    runId: number;
    collectionLoadId: number;
  } | null> {
    const row = await this.db
      .selectFrom('schemes as s')
      .innerJoin('distribution_runs as r', 'r.scheme_id', 's.scheme_id')
      .select(['r.distribution_run_id', 'r.collection_load_id'])
      .where('s.is_active', '=', true)
      .where('r.is_published', '=', true)
      .where('r.status', '=', 'DONE')
      .executeTakeFirst();
    return row
      ? {
          runId: row.distribution_run_id,
          collectionLoadId: row.collection_load_id,
        }
      : null;
  }

  async runExact(
    runId: number,
    key: string,
  ): Promise<{
    exactExists: boolean;
    locations: SearchLocationRow[];
  }> {
    const run = await this.db
      .selectFrom('distribution_runs')
      .select(['collection_load_id', 'status'])
      .where('distribution_run_id', '=', runId)
      .executeTakeFirst();
    if (!run || run.status !== 'DONE') {
      return { exactExists: false, locations: [] };
    }
    const exact = await this.db
      .selectFrom('books')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('collection_load_id', '=', run.collection_load_id)
      .where('comparable_key', '=', key)
      .executeTakeFirstOrThrow();
    if (Number(exact.count) === 0) return { exactExists: false, locations: [] };

    const locations = await this.db
      .selectFrom('books as b')
      .innerJoin('book_placements as bp', (join) =>
        join
          .onRef('bp.book_id', '=', 'b.book_id')
          .onRef('bp.collection_load_id', '=', 'b.collection_load_id'),
      )
      .innerJoin('distribution_position_inputs as p', (join) =>
        join
          .onRef('p.distribution_run_id', '=', 'bp.distribution_run_id')
          .onRef('p.location_id', '=', 'bp.location_id'),
      )
      .innerJoin('location_paths as lp', (join) =>
        join
          .onRef('lp.location_id', '=', 'bp.location_id')
          .onRef('lp.scheme_id', '=', 'bp.scheme_id'),
      )
      .innerJoin('locations as l', 'l.location_id', 'bp.location_id')
      .select([
        'lp.path',
        'l.map_element_id as mapElementId',
        'p.position_sequence as sequence',
      ])
      .where('bp.distribution_run_id', '=', runId)
      .where('b.collection_load_id', '=', run.collection_load_id)
      .where('b.comparable_key', '=', key)
      .orderBy('p.position_sequence')
      .execute();
    return { exactExists: true, locations };
  }

  runRange(runId: number, key: string): Promise<SearchLocationRow[]> {
    return this.db
      .selectFrom('distribution_ranges as r')
      .innerJoin('distribution_position_inputs as p', (join) =>
        join
          .onRef('p.distribution_run_id', '=', 'r.distribution_run_id')
          .onRef('p.location_id', '=', 'r.location_id'),
      )
      .innerJoin('location_paths as lp', (join) =>
        join
          .onRef('lp.location_id', '=', 'r.location_id')
          .onRef('lp.scheme_id', '=', 'r.scheme_id'),
      )
      .innerJoin('locations as l', 'l.location_id', 'r.location_id')
      .select([
        'lp.path',
        'l.map_element_id as mapElementId',
        'p.position_sequence as sequence',
      ])
      .where('r.distribution_run_id', '=', runId)
      .where('r.range_start_key', '<=', key)
      .where('r.range_end_key', '>', key)
      .orderBy('p.position_sequence')
      .execute();
  }

  positions(runId: number): Promise<PositionJoined[]> {
    return this.db
      .selectFrom('distribution_position_inputs as p')
      .innerJoin('location_paths as lp', (join) =>
        join
          .onRef('lp.location_id', '=', 'p.location_id')
          .onRef('lp.scheme_id', '=', 'p.scheme_id'),
      )
      .select([
        'p.location_id',
        'p.position_sequence',
        'p.capacity_value',
        'p.capacity_unit',
        'p.target_fill_ratio',
        'p.allow_overflow',
        'p.resolution',
        'lp.path',
      ])
      .where('p.distribution_run_id', '=', runId)
      .orderBy('p.position_sequence', 'asc')
      .execute() as Promise<PositionJoined[]>;
  }

  anchors(runId: number): Promise<AnchorJoined[]> {
    return this.db
      .selectFrom('distribution_anchors as a')
      .innerJoin('location_paths as lp', (join) =>
        join
          .onRef('lp.location_id', '=', 'a.location_id')
          .onRef('lp.scheme_id', '=', 'a.scheme_id'),
      )
      .innerJoin('distribution_position_inputs as p', (join) =>
        join
          .onRef('p.distribution_run_id', '=', 'a.distribution_run_id')
          .onRef('p.location_id', '=', 'a.location_id'),
      )
      .select(['a.location_id', 'a.boundary_code', 'a.boundary_key', 'lp.path'])
      .where('a.distribution_run_id', '=', runId)
      .orderBy('p.position_sequence', 'asc')
      .execute() as Promise<AnchorJoined[]>;
  }

  ranges(runId: number): Promise<RangeJoined[]> {
    return this.db
      .selectFrom('distribution_ranges as r')
      .innerJoin('location_paths as lp', (join) =>
        join
          .onRef('lp.location_id', '=', 'r.location_id')
          .onRef('lp.scheme_id', '=', 'r.scheme_id'),
      )
      .leftJoin('users as u', 'u.user_id', 'r.reviewed_by')
      .select([
        'r.distribution_range_id',
        'r.location_id',
        'r.range_sequence',
        'r.range_start_key',
        'r.range_end_key',
        'r.range_start_code',
        'r.range_end_code',
        'r.source',
        'r.book_count',
        'r.reviewed_by',
        'r.reviewed_at',
        'r.review_notes',
        'u.username as reviewer_username',
        'lp.path',
      ])
      .where('r.distribution_run_id', '=', runId)
      .orderBy('r.range_sequence', 'asc')
      .execute() as Promise<RangeJoined[]>;
  }

  async warningCounts(runId: number): Promise<{
    emptyPositionCount: number;
    overloadedPositionCount: number;
    splitKeyCount: number;
  }> {
    const [empty, overloaded, split] = await Promise.all([
      sql<{ count: number }>`
        SELECT count(*)::integer AS count
        FROM distribution_position_inputs p
        WHERE p.distribution_run_id = ${runId}
          AND NOT EXISTS (
            SELECT 1 FROM book_placements bp
            WHERE bp.distribution_run_id = p.distribution_run_id
              AND bp.location_id = p.location_id
          )
      `.execute(this.db),
      sql<{ count: number }>`
        SELECT count(*)::integer AS count
        FROM distribution_position_inputs p
        JOIN (
          SELECT location_id, count(*)::integer AS assigned
          FROM book_placements
          WHERE distribution_run_id = ${runId}
          GROUP BY location_id
        ) placed ON placed.location_id = p.location_id
        WHERE p.distribution_run_id = ${runId}
          AND p.capacity_unit = 'BOOKS'
          AND placed.assigned > floor(p.capacity_value * p.target_fill_ratio)
      `.execute(this.db),
      sql<{ count: number }>`
        SELECT count(*)::integer AS count
        FROM (
          SELECT b.comparable_key
          FROM book_placements bp
          JOIN books b
            ON b.book_id = bp.book_id
           AND b.collection_load_id = bp.collection_load_id
          WHERE bp.distribution_run_id = ${runId}
            AND b.comparable_key IS NOT NULL
          GROUP BY b.comparable_key
          HAVING count(DISTINCT bp.location_id) > 1
        ) split_keys
      `.execute(this.db),
    ]);
    return {
      emptyPositionCount: empty.rows[0]?.count ?? 0,
      overloadedPositionCount: overloaded.rows[0]?.count ?? 0,
      splitKeyCount: split.rows[0]?.count ?? 0,
    };
  }

  async derivationInputs(runId: number): Promise<{
    run: DistributionRunJoined;
    anchors: AnchorJoined[];
    ranges: RangeJoined[];
  } | null> {
    const run = await this.run(runId);
    if (!run) return null;
    const [anchors, ranges] = await Promise.all([
      this.anchors(runId),
      this.ranges(runId),
    ]);
    return { run, anchors, ranges };
  }

  async comparisonSnapshot(runId: number): Promise<{
    run: DistributionRunJoined;
    ranges: RangeJoined[];
    warnings: {
      emptyPositionCount: number;
      overloadedPositionCount: number;
      splitKeyCount: number;
    };
  } | null> {
    const run = await this.run(runId);
    if (!run) return null;
    const [ranges, warnings] = await Promise.all([
      this.ranges(runId),
      this.warningCounts(runId),
    ]);
    return { run, ranges, warnings };
  }

  async lockRun(tx: Transaction<Database>, runId: number): Promise<DistributionRunRow> {
    try {
      const row = await tx
        .selectFrom('distribution_runs')
        .selectAll()
        .where('distribution_run_id', '=', runId)
        .forUpdate()
        .noWait()
        .executeTakeFirst();
      if (!row) {
        throw ApiError.notFound(
          'DISTRIBUTION_RUN_NOT_FOUND',
          'La corrida de distribución no existe.',
        );
      }
      return row;
    } catch (error) {
      if ((error as { code?: string }).code === '55P03') {
        throw ApiError.conflict('RUN_BUSY', 'La corrida tiene otra operación en curso.');
      }
      throw error;
    }
  }

  private assertReplaceable(run: DistributionRunRow, expectedRevision: number): void {
    if (run.revision !== expectedRevision) {
      throw ApiError.conflict(
        'RUN_VERSION_CONFLICT',
        'La corrida cambió. Refrescá la vista antes de guardar.',
        { currentRevision: run.revision },
      );
    }
    if (run.is_published) {
      throw ApiError.conflict(
        'RUN_IMMUTABLE',
        'Una corrida publicada es inmutable. Creá una corrida derivada.',
      );
    }
    if (run.status === 'PENDING') {
      throw ApiError.conflict('RUN_BUSY', 'La corrida tiene otra operación en curso.');
    }
    if (run.status !== 'DONE' && run.status !== 'ERROR') {
      throw ApiError.conflict('INVALID_RUN_STATE', 'La corrida no se puede modificar.');
    }
  }

  database(): Db {
    return this.db;
  }
}
