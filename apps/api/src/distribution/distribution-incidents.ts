export interface IncidentPosition {
  locationId: number;
  capacity: number | null;
  targetFillRatio: number;
}

export interface IncidentPlacement {
  locationId: number;
  comparableKey: string;
}

export function deriveDistributionIncidents(
  positions: IncidentPosition[],
  placements: IncidentPlacement[],
  unassignedBookIds: number[],
) {
  const counts = new Map<number, number>();
  const locationsByKey = new Map<string, Set<number>>();
  for (const placement of placements) {
    counts.set(placement.locationId, (counts.get(placement.locationId) ?? 0) + 1);
    const locations = locationsByKey.get(placement.comparableKey) ?? new Set<number>();
    locations.add(placement.locationId);
    locationsByKey.set(placement.comparableKey, locations);
  }

  return {
    emptyPositionCount: positions.filter(
      (position) => (counts.get(position.locationId) ?? 0) === 0,
    ).length,
    overloadedPositionCount: positions.filter(
      (position) =>
        position.capacity !== null &&
        (counts.get(position.locationId) ?? 0) >
          Math.floor(position.capacity * position.targetFillRatio),
    ).length,
    splitKeyCount: [...locationsByKey.values()].filter((locations) => locations.size > 1)
      .length,
    unassignedCount: unassignedBookIds.length,
  };
}
