import type {
  DistributionStrategy,
  ManualRangeInput,
  RangeSource,
} from '@bjff/api-types';

import type { ResolvedPosition } from './effective-configuration.js';

export interface DistributionBook {
  bookId: number;
  comparableKey: string | null;
  classificationCode?: string | null;
}

export interface NormalizedAnchor {
  locationId: number;
  boundaryKey: string;
  boundaryCode: string;
}

export interface NormalizedManualRange extends ManualRangeInput {
  startKey: string;
  endKey: string;
}

export interface DistributionEngineInput {
  strategy: DistributionStrategy;
  books: DistributionBook[];
  positions: ResolvedPosition[];
  anchors: NormalizedAnchor[];
  manualRanges: NormalizedManualRange[];
}

export interface CalculatedPlacement {
  bookId: number;
  comparableKey: string;
  locationId: number;
  source: RangeSource;
}

export interface CalculatedRange {
  locationId: number;
  rangeSequence: number;
  rangeStartKey: string;
  rangeEndKey: string;
  rangeStartCode: string | null;
  rangeEndCode: string | null;
  source: RangeSource;
  bookCount: number;
}

export interface DistributionEngineResult {
  placements: CalculatedPlacement[];
  ranges: CalculatedRange[];
  unassignedBookIds: number[];
  incidents: {
    emptyLocationIds: number[];
    overloadedLocationIds: number[];
    splitKeys: string[];
  };
}

export class DistributionDomainError extends Error {
  constructor(
    readonly code:
      | 'INVALID_STRATEGY_INPUTS'
      | 'INVALID_EFFECTIVE_CONFIGURATION'
      | 'INVALID_ANCHORS'
      | 'INVALID_MANUAL_RANGES',
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function calculateDistribution(
  input: DistributionEngineInput,
): DistributionEngineResult {
  const positions = [...input.positions].sort(
    (left, right) => left.positionSequence - right.positionSequence,
  );
  validateInput({ ...input, positions });
  const comparableBooks = input.books
    .filter(
      (book): book is DistributionBook & { comparableKey: string } =>
        book.comparableKey !== null,
    )
    .sort(
      (left, right) =>
        compareKeys(left.comparableKey, right.comparableKey) ||
        left.bookId - right.bookId,
    );
  const withoutKey = input.books
    .filter((book) => book.comparableKey === null)
    .map((book) => book.bookId);

  if (input.strategy === 'MANUAL') {
    return manualDistribution(comparableBooks, positions, input.manualRanges, withoutKey);
  }

  const groups = groupBooks(comparableBooks);
  const placements: CalculatedPlacement[] = [];
  const unassignedBookIds = [...withoutKey];
  const orderedAnchors = [...input.anchors].sort(
    (left, right) =>
      positionIndex(positions, left.locationId) -
      positionIndex(positions, right.locationId),
  );
  const segmentStarts = [
    { positionIndex: 0, key: '' },
    ...orderedAnchors.map((anchor) => ({
      positionIndex: positionIndex(positions, anchor.locationId),
      key: anchor.boundaryKey,
    })),
  ];

  for (const [segmentIndex, start] of segmentStarts.entries()) {
    const end = segmentStarts[segmentIndex + 1];
    const segmentPositions = positions.slice(start.positionIndex, end?.positionIndex);
    const segmentGroups = groups.filter(
      (group) =>
        compareKeys(group.key, start.key) >= 0 &&
        (end === undefined || compareKeys(group.key, end.key) < 0),
    );
    const assigned = assignGroups(
      segmentGroups,
      segmentPositions,
      input.strategy,
      input.strategy === 'ANCHORED' || orderedAnchors.length > 0 ? 'ANCHORED' : 'AUTO',
    );
    placements.push(...assigned.placements);
    unassignedBookIds.push(...assigned.unassignedBookIds);
  }

  return finishResult(
    positions,
    placements,
    unassignedBookIds,
    automaticRanges(positions, placements, orderedAnchors, comparableBooks),
  );
}

function assignGroups(
  groups: Array<{
    key: string;
    books: Array<DistributionBook & { comparableKey: string }>;
  }>,
  positions: ResolvedPosition[],
  strategy: DistributionStrategy,
  source: RangeSource,
): { placements: CalculatedPlacement[]; unassignedBookIds: number[] } {
  const placements: CalculatedPlacement[] = [];
  const unassignedBookIds: number[] = [];
  if (positions.length === 0) {
    return {
      placements,
      unassignedBookIds: groups.flatMap((group) =>
        group.books.map((book) => book.bookId),
      ),
    };
  }
  const targets = targetsFor(
    strategy,
    positions,
    groups.reduce((sum, group) => sum + group.books.length, 0),
  );
  const assigned = Array.from({ length: positions.length }, () => 0);
  let current = 0;

  for (const group of groups) {
    while (current < positions.length && assigned[current]! >= targets[current]!)
      current += 1;
    if (current >= positions.length) {
      unassignedBookIds.push(...group.books.map((book) => book.bookId));
      continue;
    }
    const remaining = targets[current]! - assigned[current]!;
    if (group.books.length <= remaining) {
      placeBooks(group.books, positions[current]!, source, placements);
      assigned[current]! += group.books.length;
      continue;
    }
    const later = targets.findIndex(
      (target, index) =>
        index > current && group.books.length <= target - assigned[index]!,
    );
    if (later >= 0) {
      current = later;
      placeBooks(group.books, positions[current]!, source, placements);
      assigned[current]! += group.books.length;
      continue;
    }
    if (positions[current]!.allowOverflow) {
      placeBooks(group.books, positions[current]!, source, placements);
      assigned[current]! += group.books.length;
      continue;
    }

    let offset = 0;
    for (
      let index = current;
      index < positions.length && offset < group.books.length;
      index += 1
    ) {
      const available = Math.max(0, targets[index]! - assigned[index]!);
      const slice = group.books.slice(offset, offset + available);
      placeBooks(slice, positions[index]!, source, placements);
      assigned[index]! += slice.length;
      offset += slice.length;
      current = index;
    }
    if (offset < group.books.length) {
      unassignedBookIds.push(...group.books.slice(offset).map((book) => book.bookId));
    }
  }
  return { placements, unassignedBookIds };
}

function manualDistribution(
  books: Array<DistributionBook & { comparableKey: string }>,
  positions: ResolvedPosition[],
  ranges: NormalizedManualRange[],
  withoutKey: number[],
): DistributionEngineResult {
  const byLocation = new Map(
    positions.map((position) => [position.locationId, position]),
  );
  const placements: CalculatedPlacement[] = [];
  const unassignedBookIds = [...withoutKey];
  for (const book of books) {
    const range = ranges.find(
      (candidate) =>
        compareKeys(candidate.startKey, book.comparableKey) <= 0 &&
        compareKeys(book.comparableKey, candidate.endKey) < 0,
    );
    if (!range || !byLocation.has(range.locationId)) {
      unassignedBookIds.push(book.bookId);
      continue;
    }
    placements.push({
      bookId: book.bookId,
      comparableKey: book.comparableKey,
      locationId: range.locationId,
      source: 'MANUAL',
    });
  }
  const calculatedRanges = ranges.map((range, index) => ({
    locationId: range.locationId,
    rangeSequence: index + 1,
    rangeStartKey: range.startKey,
    rangeEndKey: range.endKey,
    rangeStartCode: range.startCode,
    rangeEndCode: range.endCode,
    source: 'MANUAL' as const,
    bookCount: placements.filter((placement) => placement.locationId === range.locationId)
      .length,
  }));
  return finishResult(positions, placements, unassignedBookIds, calculatedRanges);
}

function automaticRanges(
  positions: ResolvedPosition[],
  placements: CalculatedPlacement[],
  anchors: NormalizedAnchor[],
  books: Array<DistributionBook & { comparableKey: string }>,
): CalculatedRange[] {
  const anchorByLocation = new Map(anchors.map((anchor) => [anchor.locationId, anchor]));
  const codeByKey = new Map(
    books.map((book) => [book.comparableKey, book.classificationCode ?? null]),
  );
  const starts: Array<{
    locationId: number;
    key: string;
    code: string | null;
    source: RangeSource;
  }> = [{ locationId: positions[0]!.locationId, key: '', code: null, source: 'AUTO' }];

  for (const position of positions.slice(1)) {
    const anchor = anchorByLocation.get(position.locationId);
    if (anchor) {
      starts.push({
        locationId: position.locationId,
        key: anchor.boundaryKey,
        code: anchor.boundaryCode,
        source: 'ANCHORED',
      });
      continue;
    }
    const keys = placements
      .filter((placement) => placement.locationId === position.locationId)
      .map((placement) => placement.comparableKey)
      .sort(compareKeys);
    const firstKey = keys[0];
    if (firstKey === undefined) continue;
    const previousPosition = positions[position.positionSequence - 2];
    const previousHasSameKey = placements.some(
      (placement) =>
        placement.locationId === previousPosition?.locationId &&
        placement.comparableKey === firstKey,
    );
    if (!previousHasSameKey) {
      starts.push({
        locationId: position.locationId,
        key: firstKey,
        code: codeByKey.get(firstKey) ?? null,
        source: 'AUTO',
      });
    }
  }

  return starts.map((start, index) => {
    const end = starts[index + 1];
    return {
      locationId: start.locationId,
      rangeSequence: index + 1,
      rangeStartKey: start.key,
      rangeEndKey: end?.key ?? '~',
      rangeStartCode: start.code,
      rangeEndCode: end?.code ?? null,
      source: start.source,
      bookCount: placements.filter(
        (placement) => placement.locationId === start.locationId,
      ).length,
    };
  });
}

function finishResult(
  positions: ResolvedPosition[],
  placements: CalculatedPlacement[],
  unassignedBookIds: number[],
  ranges: CalculatedRange[],
): DistributionEngineResult {
  const counts = new Map<number, number>();
  const locationsByKey = new Map<string, Set<number>>();
  for (const placement of placements) {
    counts.set(placement.locationId, (counts.get(placement.locationId) ?? 0) + 1);
    const locations = locationsByKey.get(placement.comparableKey) ?? new Set<number>();
    locations.add(placement.locationId);
    locationsByKey.set(placement.comparableKey, locations);
  }
  return {
    placements,
    ranges,
    unassignedBookIds,
    incidents: {
      emptyLocationIds: positions
        .filter((position) => !counts.has(position.locationId))
        .map((position) => position.locationId),
      overloadedLocationIds: positions
        .filter(
          (position) =>
            position.capacity?.unit === 'BOOKS' &&
            (counts.get(position.locationId) ?? 0) >
              Math.floor(position.capacity.value * position.targetFillRatio),
        )
        .map((position) => position.locationId),
      splitKeys: [...locationsByKey.entries()]
        .filter(([, locations]) => locations.size > 1)
        .map(([key]) => key),
    },
  };
}

function validateInput(input: DistributionEngineInput): void {
  if (input.positions.length === 0) {
    throw new DistributionDomainError(
      'INVALID_EFFECTIVE_CONFIGURATION',
      'El scheme no tiene posiciones utilizables.',
    );
  }
  const positionIds = new Set(input.positions.map((position) => position.locationId));
  const foreignAnchor = input.anchors.find(
    (anchor) => !positionIds.has(anchor.locationId),
  );
  if (foreignAnchor) {
    throw new DistributionDomainError(
      'INVALID_ANCHORS',
      'Un anchor no pertenece a la corrida.',
      { locationId: foreignAnchor.locationId },
    );
  }
  if (input.strategy === 'MANUAL') {
    if (input.anchors.length > 0) invalidStrategy('MANUAL no admite anchors.');
    validateManualRanges(input.positions, input.manualRanges);
    return;
  }
  if (input.manualRanges.length > 0)
    invalidStrategy('La estrategia no admite rangos manuales.');
  if (input.strategy === 'CAPACITY') {
    if (input.positions.some((position) => position.capacity?.unit !== 'BOOKS')) {
      throw new DistributionDomainError(
        'INVALID_EFFECTIVE_CONFIGURATION',
        'La estrategia requiere capacidades en libros para todas las posiciones.',
      );
    }
  }
  if (input.strategy === 'HYBRID') {
    const units = new Set(input.positions.map((position) => position.capacity?.unit));
    if (
      units.size !== 1 ||
      ![...units].every(
        (unit) => unit === 'BOOKS' || unit === 'WEIGHT' || unit === 'CENTIMETERS',
      )
    ) {
      throw new DistributionDomainError(
        'INVALID_EFFECTIVE_CONFIGURATION',
        'HYBRID requiere una unidad común en todas las posiciones.',
      );
    }
  }
  if (input.strategy === 'CAPACITY' && input.anchors.length > 0) {
    invalidStrategy('CAPACITY no admite anchors.');
  }
  if (input.strategy === 'WEIGHTED') {
    if (input.anchors.length > 0) invalidStrategy('WEIGHTED no admite anchors.');
    const units = new Set(input.positions.map((position) => position.capacity?.unit));
    if (units.size !== 1 || (!units.has('WEIGHT') && !units.has('CENTIMETERS'))) {
      throw new DistributionDomainError(
        'INVALID_EFFECTIVE_CONFIGURATION',
        'WEIGHTED requiere una unidad relativa común.',
      );
    }
  }
  validateAnchors(input.positions, input.anchors, input.strategy === 'ANCHORED');
}

function validateAnchors(
  positions: ResolvedPosition[],
  anchors: NormalizedAnchor[],
  requireComplete: boolean,
): void {
  const ordered = [...anchors].sort(
    (left, right) =>
      positionIndex(positions, left.locationId) -
      positionIndex(positions, right.locationId),
  );
  if (ordered.some((anchor) => positionIndex(positions, anchor.locationId) === 0)) {
    throw new DistributionDomainError(
      'INVALID_ANCHORS',
      'La primera posición no admite anchor.',
      { locationId: positions[0]?.locationId },
    );
  }
  if (requireComplete && ordered.length !== positions.length - 1) {
    throw new DistributionDomainError(
      'INVALID_ANCHORS',
      'ANCHORED requiere una frontera para cada posición posterior a la primera.',
      {
        missingLocationIds: positions
          .slice(1)
          .filter(
            (position) =>
              !ordered.some((anchor) => anchor.locationId === position.locationId),
          )
          .map((position) => position.locationId),
      },
    );
  }
  for (let index = 1; index < ordered.length; index += 1) {
    if (compareKeys(ordered[index - 1]!.boundaryKey, ordered[index]!.boundaryKey) >= 0) {
      throw new DistributionDomainError(
        'INVALID_ANCHORS',
        'Los anchors deben avanzar en orden.',
        { locationId: ordered[index]!.locationId },
      );
    }
  }
}

function validateManualRanges(
  positions: ResolvedPosition[],
  ranges: NormalizedManualRange[],
): void {
  if (
    ranges.length === 0 ||
    ranges[0]?.startKey !== '' ||
    ranges.at(-1)?.endKey !== '~'
  ) {
    throw new DistributionDomainError(
      'INVALID_MANUAL_RANGES',
      'La cobertura manual debe abarcar desde el inicio global hasta el final.',
    );
  }
  const ids = new Set(positions.map((position) => position.locationId));
  for (const [index, range] of ranges.entries()) {
    if (!ids.has(range.locationId) || compareKeys(range.startKey, range.endKey) >= 0) {
      throw new DistributionDomainError(
        'INVALID_MANUAL_RANGES',
        'Un rango manual no es válido.',
        { locationId: range.locationId, index },
      );
    }
    if (index > 0 && ranges[index - 1]!.endKey !== range.startKey) {
      throw new DistributionDomainError(
        'INVALID_MANUAL_RANGES',
        'Los rangos manuales deben ser continuos.',
        { locationId: range.locationId, index },
      );
    }
  }
}

function targetsFor(
  strategy: DistributionStrategy,
  positions: ResolvedPosition[],
  bookCount: number,
): number[] {
  if (strategy === 'ANCHORED') return positions.map(() => Number.MAX_SAFE_INTEGER);
  const unit = positions[0]?.capacity?.unit;
  if (strategy === 'WEIGHTED' || (strategy === 'HYBRID' && unit !== 'BOOKS')) {
    const weights = positions.map(
      (position) => (position.capacity?.value ?? 0) * position.targetFillRatio,
    );
    const total = weights.reduce((sum, value) => sum + value, 0);
    let assigned = 0;
    return weights.map((weight, index) => {
      const target =
        index === weights.length - 1
          ? bookCount - assigned
          : Math.floor((bookCount * weight) / total);
      assigned += target;
      return target;
    });
  }
  return positions.map((position) =>
    Math.floor((position.capacity?.value ?? 0) * position.targetFillRatio),
  );
}

function groupBooks(books: Array<DistributionBook & { comparableKey: string }>) {
  const groups: Array<{
    key: string;
    books: Array<DistributionBook & { comparableKey: string }>;
  }> = [];
  for (const book of books) {
    const last = groups.at(-1);
    if (last?.key === book.comparableKey) last.books.push(book);
    else groups.push({ key: book.comparableKey, books: [book] });
  }
  return groups;
}

function placeBooks(
  books: Array<DistributionBook & { comparableKey: string }>,
  position: ResolvedPosition,
  source: RangeSource,
  placements: CalculatedPlacement[],
): void {
  placements.push(
    ...books.map((book) => ({
      bookId: book.bookId,
      comparableKey: book.comparableKey,
      locationId: position.locationId,
      source,
    })),
  );
}

function positionIndex(positions: ResolvedPosition[], locationId: number): number {
  return positions.findIndex((position) => position.locationId === locationId);
}

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function invalidStrategy(message: string): never {
  throw new DistributionDomainError('INVALID_STRATEGY_INPUTS', message);
}
