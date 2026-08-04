import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';

import { calculateDistribution } from '../../src/distribution/distribution-engine.js';

describe('rendimiento sintético de distribución', () => {
  it('calcula 100.000 registros y 1.000 posiciones en menos de dos minutos', () => {
    const books = Array.from({ length: 100_000 }, (_, index) => ({
      bookId: index + 1,
      comparableKey: String(index).padStart(12, '0'),
    }));
    const positions = Array.from({ length: 1_000 }, (_, index) => ({
      locationId: index + 1,
      positionSequence: index + 1,
      capacity: { value: 100, unit: 'BOOKS' as const },
      targetFillRatio: 1,
      allowOverflow: false,
      resolution: {
        capacity: { source: 'RUN' as const, sourceId: null },
        targetFillRatio: { source: 'RUN' as const, sourceId: null },
        allowOverflow: { source: 'RUN' as const, sourceId: null },
      },
    }));

    const startedAt = performance.now();
    const result = calculateDistribution({
      strategy: 'CAPACITY',
      books,
      positions,
      anchors: [],
      manualRanges: [],
    });
    const durationMs = performance.now() - startedAt;

    expect(result.placements).toHaveLength(100_000);
    expect(result.unassignedBookIds).toHaveLength(0);
    expect(durationMs).toBeLessThan(120_000);
  }, 125_000);
});
