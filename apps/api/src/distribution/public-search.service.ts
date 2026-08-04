import { Injectable } from '@nestjs/common';
import type { PublicLocation, PublicSearchResult } from '@bjff/api-types';

import {
  DistributionRepository,
  type SearchLocationRow,
} from './distribution.repository.js';
import { searchableClassificationKey } from './search-classification.js';

const NOT_FOUND: PublicSearchResult = {
  status: 'NOT_FOUND',
  matchType: null,
  approximate: true,
  message: 'No hay una ubicación aproximada disponible para este código.',
  locations: [],
};

@Injectable()
export class PublicSearchService {
  constructor(private readonly repository: DistributionRepository) {}

  async search(classificationCode: string): Promise<PublicSearchResult> {
    const key = searchableClassificationKey(classificationCode);
    if (key === null) return NOT_FOUND;

    const exact = await this.repository.publicExact(key);
    if (!exact.distributionAvailable) return NOT_FOUND;
    if (exact.exactExists) {
      const locations = uniqueLocations(exact.locations);
      return locations.length === 0 ? NOT_FOUND : found('EXACT', locations);
    }
    const locations = uniqueLocations(await this.repository.publicRange(key));
    return locations.length === 0 ? NOT_FOUND : found('RANGE', locations);
  }
}

function uniqueLocations(rows: SearchLocationRow[]): PublicLocation[] {
  const seen = new Set<string>();
  return [...rows]
    .sort((left, right) => left.sequence - right.sequence)
    .filter((row) => {
      const key = `${row.path}\u0000${row.mapElementId ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((row) => ({ path: row.path, mapElementId: row.mapElementId }));
}

function found(
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
