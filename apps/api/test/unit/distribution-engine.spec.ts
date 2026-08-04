import { describe, expect, it } from 'vitest';

import { calculateDistribution } from '../../src/distribution/distribution-engine.js';

function position(
  locationId: number,
  sequence: number,
  capacity: number,
  allowOverflow = false,
) {
  return {
    locationId,
    positionSequence: sequence,
    capacity: { value: capacity, unit: 'BOOKS' as const },
    targetFillRatio: 1,
    allowOverflow,
    resolution: {
      capacity: { source: 'RUN' as const, sourceId: null },
      targetFillRatio: { source: 'RUN' as const, sourceId: null },
      allowOverflow: { source: 'RUN' as const, sourceId: null },
    },
  };
}

function books(...keys: Array<string | null>) {
  return keys.map((comparableKey, index) => ({ bookId: index + 1, comparableKey }));
}

describe('motor de distribución híbrida', () => {
  it('es determinista, deja sin asignar claves nulas y crea cobertura semiabierta', () => {
    const input = {
      strategy: 'HYBRID' as const,
      books: books('B', null, 'A', 'C'),
      positions: [position(1, 1, 2), position(2, 2, 2)],
      anchors: [],
      manualRanges: [],
    };
    const first = calculateDistribution(input);
    const second = calculateDistribution(input);
    expect(second).toEqual(first);
    expect(first.placements.map((item) => item.bookId)).toEqual([3, 1, 4]);
    expect(first.unassignedBookIds).toEqual([2]);
    expect(first.ranges[0]?.rangeStartKey).toBe('');
    expect(first.ranges.at(-1)?.rangeEndKey).toBe('~');
  });

  it('salta a una posición posterior si el grupo cabe completo', () => {
    const result = calculateDistribution({
      strategy: 'HYBRID',
      books: books('A', 'B', 'B', 'B'),
      positions: [position(1, 1, 2), position(2, 2, 3)],
      anchors: [],
      manualRanges: [],
    });
    expect(result.placements.filter((item) => item.comparableKey === 'B')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ locationId: 2 }),
        expect.objectContaining({ locationId: 2 }),
        expect.objectContaining({ locationId: 2 }),
      ]),
    );
  });

  it('conserva unido un grupo con overflow y advierte la sobrecarga', () => {
    const result = calculateDistribution({
      strategy: 'HYBRID',
      books: books('A', 'A', 'A'),
      positions: [position(1, 1, 2, true)],
      anchors: [],
      manualRanges: [],
    });
    expect(result.placements).toHaveLength(3);
    expect(result.incidents.overloadedLocationIds).toEqual([1]);
  });

  it('divide solo entre posiciones consecutivas cuando overflow no está permitido', () => {
    const result = calculateDistribution({
      strategy: 'HYBRID',
      books: books('A', 'A', 'A'),
      positions: [position(1, 1, 2), position(2, 2, 2)],
      anchors: [],
      manualRanges: [],
    });
    expect(result.placements.map((item) => item.locationId)).toEqual([1, 1, 2]);
    expect(result.incidents.splitKeys).toEqual(['A']);
    expect(result.ranges).toHaveLength(1);
  });
});

describe('contratos de estrategias', () => {
  it('CAPACITY aplica Math.floor y no admite anchors', () => {
    const result = calculateDistribution({
      strategy: 'CAPACITY',
      books: books('A', 'B', 'C'),
      positions: [
        { ...position(1, 1, 3), targetFillRatio: 0.5 },
        { ...position(2, 2, 3), targetFillRatio: 0.5 },
      ],
      anchors: [],
      manualRanges: [],
    });
    expect(result.placements).toHaveLength(2);
    expect(result.unassignedBookIds).toEqual([3]);
    expect(() =>
      calculateDistribution({
        strategy: 'CAPACITY',
        books: books('A'),
        positions: [position(1, 1, 2), position(2, 2, 2)],
        anchors: [{ locationId: 2, boundaryCode: 'B', boundaryKey: 'B' }],
        manualRanges: [],
      }),
    ).toThrowError(/no admite anchors/i);
  });

  it('WEIGHTED reparte por peso efectivo relativo y exige una unidad relativa común', () => {
    const weighted = (locationId: number, sequence: number, value: number) => ({
      ...position(locationId, sequence, value),
      capacity: { value, unit: 'WEIGHT' as const },
    });
    const result = calculateDistribution({
      strategy: 'WEIGHTED',
      books: books('A', 'B', 'C', 'D'),
      positions: [weighted(1, 1, 1), weighted(2, 2, 3)],
      anchors: [],
      manualRanges: [],
    });
    expect(result.placements.map((placement) => placement.locationId)).toEqual([
      1, 2, 2, 2,
    ]);
    expect(() =>
      calculateDistribution({
        strategy: 'WEIGHTED',
        books: books('A'),
        positions: [
          weighted(1, 1, 1),
          { ...weighted(2, 2, 1), capacity: { value: 1, unit: 'CENTIMETERS' } },
        ],
        anchors: [],
        manualRanges: [],
      }),
    ).toThrowError(/unidad relativa común/i);
  });

  it('ANCHORED exige fronteras completas y no desplaza la frontera por capacidad', () => {
    const input = {
      strategy: 'ANCHORED' as const,
      books: books('A', 'B', 'C', 'D'),
      positions: [position(1, 1, 1), position(2, 2, 1)],
      anchors: [{ locationId: 2, boundaryCode: 'C', boundaryKey: 'C' }],
      manualRanges: [],
    };
    const result = calculateDistribution(input);
    expect(result.placements.map((placement) => placement.locationId)).toEqual([
      1, 1, 2, 2,
    ]);
    expect(result.placements.every((placement) => placement.source === 'ANCHORED')).toBe(
      true,
    );
    expect(() => calculateDistribution({ ...input, anchors: [] })).toThrowError(
      /requiere una frontera/i,
    );
  });

  it('HYBRID admite anchors parciales y calcula cada segmento', () => {
    const result = calculateDistribution({
      strategy: 'HYBRID',
      books: books('A', 'B', 'C', 'D'),
      positions: [position(1, 1, 2), position(2, 2, 1), position(3, 3, 1)],
      anchors: [{ locationId: 2, boundaryCode: 'C', boundaryKey: 'C' }],
      manualRanges: [],
    });
    expect(result.placements.map((placement) => placement.locationId)).toEqual([
      1, 1, 2, 3,
    ]);
  });

  it('HYBRID reparte proporcionalmente cuando usa una unidad relativa común', () => {
    const relative = (locationId: number, sequence: number, value: number) => ({
      ...position(locationId, sequence, value),
      capacity: { value, unit: 'CENTIMETERS' as const },
    });
    const result = calculateDistribution({
      strategy: 'HYBRID',
      books: books('A', 'B', 'C', 'D'),
      positions: [relative(1, 1, 1), relative(2, 2, 3)],
      anchors: [],
      manualRanges: [],
    });
    expect(result.placements.map((placement) => placement.locationId)).toEqual([
      1, 2, 2, 2,
    ]);
    expect(() =>
      calculateDistribution({
        strategy: 'HYBRID',
        books: books('A'),
        positions: [
          relative(1, 1, 1),
          {
            ...relative(2, 2, 1),
            capacity: { value: 1, unit: 'WEIGHT' },
          },
        ],
        anchors: [],
        manualRanges: [],
      }),
    ).toThrowError(/unidad común/i);
  });

  it('MANUAL exige cobertura continua completa y marca el origen', () => {
    const input = {
      strategy: 'MANUAL' as const,
      books: books('A', 'M', 'Z'),
      positions: [position(1, 1, 1), position(2, 2, 1)],
      anchors: [],
      manualRanges: [
        {
          locationId: 1,
          startCode: null,
          endCode: 'M',
          startKey: '',
          endKey: 'M',
        },
        {
          locationId: 2,
          startCode: 'M',
          endCode: null,
          startKey: 'M',
          endKey: '~',
        },
      ],
    };
    const result = calculateDistribution(input);
    expect(result.placements.map((placement) => placement.locationId)).toEqual([1, 2, 2]);
    expect(result.ranges.every((range) => range.source === 'MANUAL')).toBe(true);
    expect(() =>
      calculateDistribution({
        ...input,
        manualRanges: [input.manualRanges[0]!],
      }),
    ).toThrowError(/inicio global hasta el final/i);
  });
});
