import { describe, expect, it } from 'vitest';

import { resolveEffectiveConfiguration } from '../../src/distribution/effective-configuration.js';

const runDefaults = {
  capacity: { value: 50, unit: 'BOOKS' as const },
  targetFillRatio: 0.8,
  allowOverflow: false,
};

describe('resolución de configuración efectiva', () => {
  it('resuelve cada campo por precedencia y conserva su origen', () => {
    const [resolved] = resolveEffectiveConfiguration(
      [
        {
          locationId: 10,
          templateNodeId: 100,
          leafSequence: 1,
          enabled: true,
          pathEnabled: true,
          settings: {
            capacity: { value: 12, unit: 'BOOKS' as const },
            targetFillRatio: null,
            allowOverflow: null,
            inheritToDescendants: false,
          },
          ancestors: [
            {
              locationId: 5,
              settings: {
                capacity: { value: 99, unit: 'WEIGHT' as const },
                targetFillRatio: 0.7,
                allowOverflow: null,
                inheritToDescendants: true,
              },
            },
          ],
          templateDefaults: {
            capacity: { value: 20, unit: 'BOOKS' as const },
            targetFillRatio: 0.6,
            allowOverflow: true,
          },
        },
      ],
      runDefaults,
    );

    expect(resolved).toMatchObject({
      locationId: 10,
      capacity: { value: 12, unit: 'BOOKS' },
      targetFillRatio: 0.7,
      allowOverflow: true,
      resolution: {
        capacity: { source: 'LOCATION', sourceId: 10 },
        targetFillRatio: { source: 'ANCESTOR', sourceId: 5 },
        allowOverflow: { source: 'TEMPLATE', sourceId: 100 },
      },
    });
  });

  it('toma capacidad y unidad del mismo nivel y usa defaults de corrida al final', () => {
    const [resolved] = resolveEffectiveConfiguration(
      [
        {
          locationId: 11,
          templateNodeId: 101,
          leafSequence: 2,
          enabled: true,
          pathEnabled: true,
          settings: null,
          ancestors: [],
          templateDefaults: null,
        },
      ],
      runDefaults,
    );
    expect(resolved!.capacity).toEqual({ value: 50, unit: 'BOOKS' });
    expect(resolved!.resolution.capacity).toEqual({ source: 'RUN', sourceId: null });
  });

  it('usa el ancestro heredable más cercano y excluye ramas deshabilitadas', () => {
    const resolved = resolveEffectiveConfiguration(
      [
        {
          locationId: 12,
          templateNodeId: 102,
          leafSequence: 3,
          enabled: true,
          pathEnabled: true,
          settings: null,
          ancestors: [
            {
              locationId: 8,
              settings: {
                capacity: null,
                targetFillRatio: 0.75,
                allowOverflow: null,
                inheritToDescendants: false,
              },
            },
            {
              locationId: 7,
              settings: {
                capacity: null,
                targetFillRatio: 0.65,
                allowOverflow: null,
                inheritToDescendants: true,
              },
            },
          ],
          templateDefaults: null,
        },
        {
          locationId: 13,
          templateNodeId: 103,
          leafSequence: 4,
          enabled: true,
          pathEnabled: false,
          settings: null,
          ancestors: [],
          templateDefaults: null,
        },
      ],
      runDefaults,
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]?.targetFillRatio).toBe(0.65);
    expect(resolved[0]?.resolution.targetFillRatio).toEqual({
      source: 'ANCESTOR',
      sourceId: 7,
    });
  });
});
