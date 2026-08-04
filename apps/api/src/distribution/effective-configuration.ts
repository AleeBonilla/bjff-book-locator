import type {
  Capacity,
  DistributionPositionInput,
  DistributionValues,
  FieldResolution,
  RunDefaults,
} from '@bjff/api-types';

export interface EffectiveSettings extends DistributionValues {
  inheritToDescendants: boolean;
}

export interface PositionConfigurationSource {
  locationId: number;
  templateNodeId: number;
  leafSequence: number;
  enabled: boolean;
  pathEnabled: boolean;
  settings: EffectiveSettings | null;
  /** Ancestros desde el padre inmediato hacia la raíz. */
  ancestors: Array<{ locationId: number; settings: EffectiveSettings | null }>;
  templateDefaults: DistributionValues | null;
}

export type ResolvedPosition = Omit<DistributionPositionInput, 'path'>;

export function resolveEffectiveConfiguration(
  positions: PositionConfigurationSource[],
  runDefaults: RunDefaults,
): ResolvedPosition[] {
  return positions
    .filter((position) => position.enabled && position.pathEnabled)
    .sort((left, right) => left.leafSequence - right.leafSequence)
    .map((position) => {
      const inherited = position.ancestors.filter(
        (ancestor) => ancestor.settings?.inheritToDescendants,
      );
      const capacity = resolveField<Capacity | null>(
        position,
        position.settings?.capacity,
        inherited.map((ancestor) => ({
          value: ancestor.settings?.capacity,
          sourceId: ancestor.locationId,
        })),
        position.templateDefaults?.capacity,
        runDefaults.capacity,
      );
      const targetFillRatio = resolveField<number>(
        position,
        position.settings?.targetFillRatio,
        inherited.map((ancestor) => ({
          value: ancestor.settings?.targetFillRatio,
          sourceId: ancestor.locationId,
        })),
        position.templateDefaults?.targetFillRatio,
        runDefaults.targetFillRatio,
      );
      const allowOverflow = resolveField<boolean>(
        position,
        position.settings?.allowOverflow,
        inherited.map((ancestor) => ({
          value: ancestor.settings?.allowOverflow,
          sourceId: ancestor.locationId,
        })),
        position.templateDefaults?.allowOverflow,
        runDefaults.allowOverflow,
      );

      return {
        locationId: position.locationId,
        positionSequence: position.leafSequence,
        capacity: capacity.value,
        targetFillRatio: targetFillRatio.value,
        allowOverflow: allowOverflow.value,
        resolution: {
          capacity: capacity.resolution,
          targetFillRatio: targetFillRatio.resolution,
          allowOverflow: allowOverflow.resolution,
        },
      };
    });
}

function resolveField<T>(
  position: PositionConfigurationSource,
  direct: T | null | undefined,
  ancestors: Array<{ value: T | null | undefined; sourceId: number }>,
  template: T | null | undefined,
  run: T,
): { value: T; resolution: FieldResolution } {
  if (direct !== null && direct !== undefined) {
    return {
      value: direct,
      resolution: { source: 'LOCATION', sourceId: position.locationId },
    };
  }
  const inherited = ancestors.find(
    (candidate) => candidate.value !== null && candidate.value !== undefined,
  );
  if (inherited?.value !== null && inherited?.value !== undefined) {
    return {
      value: inherited.value,
      resolution: { source: 'ANCESTOR', sourceId: inherited.sourceId },
    };
  }
  if (template !== null && template !== undefined) {
    return {
      value: template,
      resolution: { source: 'TEMPLATE', sourceId: position.templateNodeId },
    };
  }
  return { value: run, resolution: { source: 'RUN', sourceId: null } };
}
