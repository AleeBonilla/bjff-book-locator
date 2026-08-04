import { describe, expect, it } from 'vitest';

import { deriveDistributionIncidents } from '../../src/distribution/distribution-incidents.js';

describe('incidencias derivadas de distribución', () => {
  it('deriva vacíos, sobrecargas, claves divididas y no asignados sin persistir estado extra', () => {
    const incidents = deriveDistributionIncidents(
      [
        { locationId: 10, capacity: 2, targetFillRatio: 1 },
        { locationId: 20, capacity: 1, targetFillRatio: 1 },
        { locationId: 30, capacity: null, targetFillRatio: 1 },
      ],
      [
        { locationId: 10, comparableKey: 'A' },
        { locationId: 20, comparableKey: 'A' },
        { locationId: 20, comparableKey: 'B' },
      ],
      [91, 92],
    );

    expect(incidents).toEqual({
      emptyPositionCount: 1,
      overloadedPositionCount: 1,
      splitKeyCount: 1,
      unassignedCount: 2,
    });
  });

  it('aplica redondeo hacia abajo al umbral efectivo', () => {
    expect(
      deriveDistributionIncidents(
        [{ locationId: 10, capacity: 3, targetFillRatio: 0.5 }],
        [
          { locationId: 10, comparableKey: 'A' },
          { locationId: 10, comparableKey: 'B' },
        ],
        [],
      ).overloadedPositionCount,
    ).toBe(1);
  });
});
