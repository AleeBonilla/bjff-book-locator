import { Injectable } from '@nestjs/common';
import type {
  CreateDistributionRunRequest,
  DistributionComparison,
  DistributionDerivationTemplate,
  DistributionPositionInput,
  DistributionRunDetail,
  DistributionRunSummary,
  FieldResolution,
  Paginado,
  PublicLocation,
  PublicSearchResult,
  RecalculateDistributionRunRequest,
} from '@bjff/api-types';
import { comparableKey } from '@bjff/classification';

import { ApiError } from '../common/api-error.js';
import { logger } from '../common/logger.js';
import type { DistributionRunRow } from '../database/schema.types.js';
import {
  calculateDistribution,
  DistributionDomainError,
  type NormalizedAnchor,
  type NormalizedManualRange,
} from './distribution-engine.js';
import {
  DistributionRepository,
  type ConfigurationRow,
  type DistributionRunJoined,
} from './distribution.repository.js';
import {
  resolveEffectiveConfiguration,
  type EffectiveSettings,
  type PositionConfigurationSource,
} from './effective-configuration.js';
import { searchableClassificationKey } from './search-classification.js';

@Injectable()
export class DistributionService {
  constructor(private readonly repository: DistributionRepository) {}

  async list(options: {
    schemeId?: number;
    status?: 'PENDING' | 'DONE' | 'ERROR';
    limit: number;
    offset: number;
  }): Promise<Paginado<DistributionRunSummary>> {
    const result = await this.repository.list(options);
    return { items: result.rows.map(toSummary), total: result.total };
  }

  async detail(runId: number): Promise<DistributionRunDetail> {
    const run = await this.repository.run(runId);
    if (!run) {
      throw ApiError.notFound(
        'DISTRIBUTION_RUN_NOT_FOUND',
        'La corrida de distribución no existe.',
      );
    }
    const [positions, anchors, ranges, warningCounts] = await Promise.all([
      this.repository.positions(runId),
      this.repository.anchors(runId),
      this.repository.ranges(runId),
      this.repository.warningCounts(runId),
    ]);

    return {
      ...toSummary(run),
      positions: positions.map((position) => ({
        locationId: position.location_id,
        positionSequence: position.position_sequence,
        path: position.path,
        capacity:
          position.capacity_value === null || position.capacity_unit === null
            ? null
            : { value: Number(position.capacity_value), unit: position.capacity_unit },
        targetFillRatio: Number(position.target_fill_ratio),
        allowOverflow: position.allow_overflow,
        resolution: toResolution(position.resolution),
      })),
      anchors: anchors.map((anchor) => ({
        locationId: anchor.location_id,
        boundaryCode: anchor.boundary_code,
        path: anchor.path,
      })),
      ranges: ranges.map((range) => ({
        distributionRangeId: range.distribution_range_id,
        locationId: range.location_id,
        rangeSequence: range.range_sequence,
        startCode: range.range_start_code,
        endCode: range.range_end_code,
        source: range.source,
        bookCount: range.book_count,
        path: range.path,
        reviewedBy:
          range.reviewed_by === null || range.reviewer_username === null
            ? null
            : { userId: range.reviewed_by, username: range.reviewer_username },
        reviewedAt: range.reviewed_at?.toISOString() ?? null,
        reviewNotes: range.review_notes,
      })),
      warnings: {
        unassignedCount: run.unassigned_count,
        ...warningCounts,
      },
    };
  }

  async create(
    command: CreateDistributionRunRequest,
    createdBy: number | null,
  ): Promise<DistributionRunDetail> {
    const startedAt = Date.now();
    const strategy = command.strategy ?? 'HYBRID';
    const [scheme, load, rows] = await Promise.all([
      this.repository.schemeForCalculation(command.schemeId),
      this.repository.loadForCalculation(command.collectionLoadId),
      this.repository.configurationRows(command.schemeId),
    ]);
    if (
      !scheme ||
      !scheme.enabled ||
      !['DEFINED', 'DISTRIBUTED'].includes(scheme.status)
    ) {
      throw ApiError.invalid(
        'INVALID_EFFECTIVE_CONFIGURATION',
        'El scheme no está disponible para una nueva corrida.',
      );
    }
    if (!load || load.status !== 'DONE') {
      throw ApiError.invalid(
        'INVALID_EFFECTIVE_CONFIGURATION',
        'La carga debe estar terminada antes de calcular.',
      );
    }
    if (
      command.basedOnDistributionRunId !== null &&
      command.basedOnDistributionRunId !== undefined
    ) {
      const base = await this.repository.run(command.basedOnDistributionRunId);
      if (!base || base.scheme_id !== command.schemeId) {
        throw ApiError.invalid(
          'INVALID_RUN_LINEAGE',
          'La corrida base debe pertenecer al mismo scheme.',
        );
      }
    }

    const runId = await this.repository.createPending({
      schemeId: command.schemeId,
      collectionLoadId: command.collectionLoadId,
      basedOnDistributionRunId: command.basedOnDistributionRunId ?? null,
      strategy,
      parameters: {},
      defaultCapacityValue: command.defaults.capacity?.value ?? null,
      defaultCapacityUnit: command.defaults.capacity?.unit ?? null,
      defaultTargetFillRatio: command.defaults.targetFillRatio,
      defaultAllowOverflow: command.defaults.allowOverflow,
      createdBy,
    });
    logger.info('distribution_calculation_started', { runId, strategy });

    try {
      const positions = resolveEffectiveConfiguration(
        configurationSources(rows),
        command.defaults,
      );
      const anchors = normalizeAnchors(command.anchors ?? []);
      const manualRanges = normalizeManualRanges(command.manualRanges ?? []);
      const books = await this.repository.booksForCalculation(command.collectionLoadId);
      const result = calculateDistribution({
        strategy,
        books,
        positions,
        anchors,
        manualRanges,
      });
      await this.repository.saveInitialCalculation(
        runId,
        command.schemeId,
        command.collectionLoadId,
        createdBy,
        positions,
        anchors,
        result,
        books.length,
      );
      logger.info('distribution_calculation_finished', {
        runId,
        result: 'DONE',
        durationMs: Date.now() - startedAt,
        bookCount: books.length,
        positionCount: positions.length,
        unassignedCount: result.unassignedBookIds.length,
      });
      return this.detail(runId);
    } catch (error) {
      const diagnostic =
        error instanceof DistributionDomainError
          ? error.message
          : 'El cálculo no pudo completarse.';
      await this.repository.markInitialError(runId, diagnostic);
      logger.error('distribution_calculation_finished', {
        runId,
        result: 'ERROR',
        durationMs: Date.now() - startedAt,
      });
      if (error instanceof DistributionDomainError) {
        throw ApiError.invalid(error.code, error.message, {
          ...error.details,
          runId,
        });
      }
      if (error instanceof ApiError) throw error;
      throw new ApiError('INTERNAL_ERROR', 'El cálculo no pudo completarse.', 500, {
        runId,
      });
    }
  }

  async recalculate(
    runId: number,
    command: RecalculateDistributionRunRequest,
    updatedBy: number | null,
  ): Promise<DistributionRunDetail> {
    const startedAt = Date.now();
    const run = await this.repository.run(runId);
    if (!run) {
      throw ApiError.notFound(
        'DISTRIBUTION_RUN_NOT_FOUND',
        'La corrida de distribución no existe.',
      );
    }
    this.assertMutable(run);
    this.assertRevision(run, command.expectedRevision);
    if (run.status !== 'DONE' && run.status !== 'ERROR') {
      throw ApiError.conflict('INVALID_RUN_STATE', 'La corrida no se puede recalcular.');
    }
    logger.info('distribution_recalculation_started', { runId, revision: run.revision });

    try {
      const positions =
        command.rebuildSnapshot || run.status === 'ERROR'
          ? resolveEffectiveConfiguration(
              configurationSources(
                await this.repository.configurationRows(run.scheme_id),
              ),
              command.defaults,
            )
          : (await this.repository.positions(runId)).map((position) => ({
              locationId: position.location_id,
              positionSequence: position.position_sequence,
              capacity:
                position.capacity_value === null || position.capacity_unit === null
                  ? null
                  : {
                      value: Number(position.capacity_value),
                      unit: position.capacity_unit,
                    },
              targetFillRatio: Number(position.target_fill_ratio),
              allowOverflow: position.allow_overflow,
              resolution: toResolution(position.resolution),
            }));
      const anchors = normalizeAnchors(command.anchors ?? []);
      const manualRanges = normalizeManualRanges(command.manualRanges ?? []);
      const books = await this.repository.booksForCalculation(run.collection_load_id);
      const result = calculateDistribution({
        strategy: run.strategy,
        books,
        positions,
        anchors,
        manualRanges,
      });
      await this.repository.replaceCalculation({
        runId,
        expectedRevision: command.expectedRevision,
        defaults: command.defaults,
        createdBy: updatedBy,
        positions,
        anchors,
        result,
        bookCount: books.length,
      });
      logger.info('distribution_recalculation_finished', {
        runId,
        result: 'DONE',
        durationMs: Date.now() - startedAt,
      });
      return this.detail(runId);
    } catch (error) {
      let revision = run.revision;
      const diagnostic =
        error instanceof DistributionDomainError
          ? error.message
          : 'El recálculo no pudo completarse.';
      if (run.status === 'ERROR' && !(error instanceof ApiError)) {
        revision = await this.repository.markRetryError(
          runId,
          command.expectedRevision,
          diagnostic,
        );
      }
      logger.error('distribution_recalculation_finished', {
        runId,
        result: 'ERROR',
        durationMs: Date.now() - startedAt,
      });
      if (error instanceof DistributionDomainError) {
        throw ApiError.invalid(error.code, error.message, {
          ...error.details,
          runId,
          ...(run.status === 'ERROR' ? { revision } : {}),
        });
      }
      throw error;
    }
  }

  async reviewRange(
    runId: number,
    rangeId: number,
    command: { expectedRevision: number; notes: string | null },
    reviewedBy: number | null,
  ): Promise<DistributionRunDetail> {
    await this.repository.reviewRange({
      runId,
      rangeId,
      expectedRevision: command.expectedRevision,
      notes: command.notes,
      reviewedBy,
    });
    return this.detail(runId);
  }

  async testSearch(
    runId: number,
    classificationCode: string,
  ): Promise<PublicSearchResult> {
    const run = await this.repository.run(runId);
    if (!run) {
      throw ApiError.notFound(
        'DISTRIBUTION_RUN_NOT_FOUND',
        'La corrida de distribución no existe.',
      );
    }
    if (run.status !== 'DONE') {
      throw ApiError.conflict(
        'INVALID_RUN_STATE',
        'La búsqueda de prueba requiere una corrida terminada.',
      );
    }
    const key = searchableClassificationKey(classificationCode);
    if (key === null) throw ApiError.invalidSearchInput();
    const exact = await this.repository.runExact(runId, key);
    if (exact.exactExists) {
      const locations = uniqueSearchLocations(exact.locations);
      return locations.length === 0 ? notFoundSearch() : foundSearch('EXACT', locations);
    }
    const locations = uniqueSearchLocations(await this.repository.runRange(runId, key));
    return locations.length === 0 ? notFoundSearch() : foundSearch('RANGE', locations);
  }

  async derivationTemplate(runId: number): Promise<DistributionDerivationTemplate> {
    const inputs = await this.repository.derivationInputs(runId);
    if (!inputs) {
      throw ApiError.notFound(
        'DISTRIBUTION_RUN_NOT_FOUND',
        'La corrida de distribución no existe.',
      );
    }
    if (inputs.run.status !== 'DONE') {
      throw ApiError.conflict(
        'INVALID_RUN_STATE',
        'Solo una corrida terminada puede usarse como base.',
      );
    }
    return {
      basedOnDistributionRunId: inputs.run.distribution_run_id,
      schemeId: inputs.run.scheme_id,
      suggestedCollectionLoadId: inputs.run.collection_load_id,
      strategy: inputs.run.strategy,
      defaults: {
        capacity:
          inputs.run.default_capacity_value === null ||
          inputs.run.default_capacity_unit === null
            ? null
            : {
                value: Number(inputs.run.default_capacity_value),
                unit: inputs.run.default_capacity_unit,
              },
        targetFillRatio: Number(inputs.run.default_target_fill_ratio),
        allowOverflow: inputs.run.default_allow_overflow,
      },
      anchors: inputs.anchors.map((anchor) => ({
        locationId: anchor.location_id,
        boundaryCode: anchor.boundary_code,
      })),
      manualRanges:
        inputs.run.strategy === 'MANUAL'
          ? inputs.ranges.map((range) => ({
              locationId: range.location_id,
              startCode: range.range_start_code,
              endCode: range.range_end_code,
            }))
          : [],
    };
  }

  async comparison(
    runId: number,
    againstRunId?: number,
  ): Promise<DistributionComparison> {
    const current = await this.repository.comparisonSnapshot(runId);
    if (!current) {
      throw ApiError.notFound(
        'DISTRIBUTION_RUN_NOT_FOUND',
        'La corrida de distribución no existe.',
      );
    }
    const comparisonId = againstRunId ?? current.run.based_on_distribution_run_id;
    if (comparisonId === null) {
      throw ApiError.invalid(
        'COMPARISON_BASE_REQUIRED',
        'Indicá una corrida para comparar porque esta versión no tiene base.',
      );
    }
    const previous = await this.repository.comparisonSnapshot(comparisonId);
    if (!previous) {
      throw ApiError.notFound(
        'DISTRIBUTION_RUN_NOT_FOUND',
        'La corrida de comparación no existe.',
      );
    }
    if (previous.run.scheme_id !== current.run.scheme_id) {
      throw ApiError.invalid(
        'INVALID_RUN_LINEAGE',
        'Las corridas comparadas deben pertenecer al mismo scheme.',
      );
    }

    const beforeByLocation = new Map(
      previous.ranges.map((range) => [range.location_id, range]),
    );
    const afterByLocation = new Map(
      current.ranges.map((range) => [range.location_id, range]),
    );
    const locationIds = new Set([...beforeByLocation.keys(), ...afterByLocation.keys()]);
    const rangeChanges = [...locationIds]
      .map((locationId) => {
        const before = beforeByLocation.get(locationId);
        const after = afterByLocation.get(locationId);
        return {
          locationId,
          path: after?.path ?? before?.path ?? '',
          before: before
            ? {
                startCode: before.range_start_code,
                endCode: before.range_end_code,
              }
            : null,
          after: after
            ? {
                startCode: after.range_start_code,
                endCode: after.range_end_code,
              }
            : null,
        };
      })
      .filter(
        (change) =>
          change.before?.startCode !== change.after?.startCode ||
          change.before?.endCode !== change.after?.endCode,
      );

    return {
      runId,
      againstRunId: comparisonId,
      counterChanges: {
        assigned:
          current.run.book_count -
          current.run.unassigned_count -
          (previous.run.book_count - previous.run.unassigned_count),
        unassigned: current.run.unassigned_count - previous.run.unassigned_count,
        emptyPositions:
          current.warnings.emptyPositionCount - previous.warnings.emptyPositionCount,
        overloadedPositions:
          current.warnings.overloadedPositionCount -
          previous.warnings.overloadedPositionCount,
        splitKeys: current.warnings.splitKeyCount - previous.warnings.splitKeyCount,
      },
      rangeChanges,
    };
  }

  async publish(
    runId: number,
    command: {
      expectedRevision: number;
      previewAccepted: boolean;
      unassignedAccepted?: boolean;
    },
  ): Promise<DistributionRunDetail> {
    const startedAt = Date.now();
    logger.info('distribution_publication_started', { runId });
    try {
      await this.repository.publish(
        runId,
        command.expectedRevision,
        command.previewAccepted,
        command.unassignedAccepted ?? false,
      );
      const detail = await this.detail(runId);
      logger.info('distribution_publication_finished', {
        runId,
        result: 'DONE',
        durationMs: Date.now() - startedAt,
      });
      return detail;
    } catch (error) {
      logger.error('distribution_publication_finished', {
        runId,
        result: 'ERROR',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }

  assertMutable(run: DistributionRunRow): void {
    if (run.is_published) {
      throw ApiError.conflict(
        'RUN_IMMUTABLE',
        'Una corrida publicada es inmutable. Creá una corrida derivada.',
      );
    }
    if (run.status === 'PENDING') {
      throw ApiError.conflict('RUN_BUSY', 'La corrida tiene otra operación en curso.');
    }
  }

  assertRevision(run: DistributionRunRow, expectedRevision: number): void {
    if (run.revision !== expectedRevision) {
      throw ApiError.conflict(
        'RUN_VERSION_CONFLICT',
        'La corrida cambió. Refrescá la vista antes de guardar.',
        { currentRevision: run.revision },
      );
    }
  }
}

function configurationSources(rows: ConfigurationRow[]): PositionConfigurationSource[] {
  const byId = new Map(rows.map((row) => [row.location_id, row]));
  return rows
    .filter((row) => row.role === 'POSITION' && row.leaf_sequence !== null)
    .map((row) => {
      const ancestors: PositionConfigurationSource['ancestors'] = [];
      let parentId = row.parent_location_id;
      let pathEnabled = row.location_enabled && row.node_enabled && row.template_enabled;
      const visited = new Set<number>([row.location_id]);
      while (parentId !== null) {
        const parent = byId.get(parentId);
        if (!parent || visited.has(parentId)) {
          pathEnabled = false;
          break;
        }
        visited.add(parentId);
        pathEnabled =
          pathEnabled &&
          parent.location_enabled &&
          parent.node_enabled &&
          parent.template_enabled;
        ancestors.push({ locationId: parent.location_id, settings: settings(parent) });
        parentId = parent.parent_location_id;
      }
      return {
        locationId: row.location_id,
        templateNodeId: row.structure_template_node_id,
        leafSequence: row.leaf_sequence!,
        enabled: row.location_enabled && row.node_enabled && row.template_enabled,
        pathEnabled,
        settings: settings(row),
        ancestors,
        templateDefaults: {
          capacity:
            row.default_capacity_value === null || row.default_capacity_unit === null
              ? null
              : {
                  value: Number(row.default_capacity_value),
                  unit: row.default_capacity_unit,
                },
          targetFillRatio:
            row.default_target_fill_ratio === null
              ? null
              : Number(row.default_target_fill_ratio),
          allowOverflow: row.default_allow_overflow,
        },
      };
    });
}

function settings(row: ConfigurationRow): EffectiveSettings | null {
  if (
    row.capacity_value === null &&
    row.target_fill_ratio === null &&
    row.allow_overflow === null
  ) {
    return null;
  }
  return {
    capacity:
      row.capacity_value === null || row.capacity_unit === null
        ? null
        : { value: Number(row.capacity_value), unit: row.capacity_unit },
    targetFillRatio:
      row.target_fill_ratio === null ? null : Number(row.target_fill_ratio),
    allowOverflow: row.allow_overflow,
    inheritToDescendants: row.inherit_to_descendants ?? false,
  };
}

function normalizeAnchors(
  anchors: NonNullable<CreateDistributionRunRequest['anchors']>,
): NormalizedAnchor[] {
  return anchors.map((anchor) => {
    const key = comparableKey(anchor.boundaryCode);
    if (key === null) {
      throw new DistributionDomainError(
        'INVALID_ANCHORS',
        'El anchor requiere un código de clasificación válido.',
        { locationId: anchor.locationId },
      );
    }
    return {
      locationId: anchor.locationId,
      boundaryCode: anchor.boundaryCode.trim(),
      boundaryKey: key,
    };
  });
}

function normalizeManualRanges(
  ranges: NonNullable<CreateDistributionRunRequest['manualRanges']>,
): NormalizedManualRange[] {
  return ranges.map((range) => {
    const startKey = range.startCode === null ? '' : comparableKey(range.startCode);
    const endKey = range.endCode === null ? '~' : comparableKey(range.endCode);
    if (startKey === null || endKey === null) {
      throw new DistributionDomainError(
        'INVALID_MANUAL_RANGES',
        'Cada frontera manual requiere un código de clasificación válido.',
        { locationId: range.locationId },
      );
    }
    return {
      ...range,
      startCode: range.startCode === null ? null : range.startCode.trim(),
      endCode: range.endCode === null ? null : range.endCode.trim(),
      startKey,
      endKey,
    };
  });
}

function toSummary(run: DistributionRunJoined): DistributionRunSummary {
  return {
    distributionRunId: run.distribution_run_id,
    schemeId: run.scheme_id,
    collectionLoadId: run.collection_load_id,
    basedOnDistributionRunId: run.based_on_distribution_run_id,
    strategy: run.strategy,
    status: run.status,
    revision: run.revision,
    defaults: {
      capacity:
        run.default_capacity_value === null || run.default_capacity_unit === null
          ? null
          : {
              value: Number(run.default_capacity_value),
              unit: run.default_capacity_unit,
            },
      targetFillRatio: Number(run.default_target_fill_ratio),
      allowOverflow: run.default_allow_overflow,
    },
    counters: {
      bookCount: run.book_count,
      positionCount: run.position_count,
      unassignedCount: run.unassigned_count,
    },
    isPublished: run.is_published,
    publishedAt: run.published_at?.toISOString() ?? null,
    errorMessage: run.error_message,
    createdBy:
      run.created_by === null || run.creator_username === null
        ? null
        : { userId: run.created_by, username: run.creator_username },
    createdAt: run.created_at.toISOString(),
    finishedAt: run.finished_at?.toISOString() ?? null,
  };
}

function toResolution(
  raw: Record<string, unknown>,
): DistributionPositionInput['resolution'] {
  return {
    capacity: fieldResolution(raw.capacity),
    targetFillRatio: fieldResolution(raw.targetFillRatio),
    allowOverflow: fieldResolution(raw.allowOverflow),
  };
}

function fieldResolution(raw: unknown): FieldResolution {
  if (typeof raw !== 'object' || raw === null) return { source: 'RUN', sourceId: null };
  const value = raw as Partial<FieldResolution>;
  if (
    value.source !== 'LOCATION' &&
    value.source !== 'ANCESTOR' &&
    value.source !== 'TEMPLATE' &&
    value.source !== 'RUN'
  ) {
    return { source: 'RUN', sourceId: null };
  }
  return {
    source: value.source,
    sourceId: typeof value.sourceId === 'number' ? value.sourceId : null,
  };
}

function uniqueSearchLocations(
  rows: Array<{ path: string; mapElementId: string | null; sequence: number }>,
): PublicLocation[] {
  const seen = new Set<string>();
  return [...rows]
    .sort((left, right) => left.sequence - right.sequence)
    .filter((row) => {
      const key = `${row.path}\u0000${row.mapElementId ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(({ path, mapElementId }) => ({ path, mapElementId }));
}

function foundSearch(
  matchType: 'EXACT' | 'RANGE',
  locations: PublicLocation[],
): PublicSearchResult {
  return {
    status: 'FOUND',
    matchType,
    approximate: true,
    message: 'Ubicación aproximada',
    locations,
  };
}

function notFoundSearch(): PublicSearchResult {
  return {
    status: 'NOT_FOUND',
    matchType: null,
    approximate: true,
    message: 'No hay una ubicación aproximada disponible para este código.',
    locations: [],
  };
}
