import type { Queryable } from '../db/transaction.js';
import { ApiError } from '../errors.js';

export interface SchemeRow {
  scheme_id: number;
  name: string;
  status: 'DRAFT' | 'LEVELS_DEFINED' | 'LOCATIONS_DEFINED' | 'PARTIALLY_ASSIGNED' | 'ASSIGNED';
  short_description: string | null;
  is_active: boolean;
  enabled: boolean;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface LevelRow {
  scheme_level_id: number;
  parent_level_id: number | null;
  name: string;
  sort_order: number;
  is_search_terminal: boolean;
}

export interface LocationRow {
  location_id: number;
  parent_location_id: number | null;
  scheme_level_id: number;
  level_name: string;
  level_is_terminal: boolean;
  name: string;
  code: string;
  sort_order: number;
  range_start_raw: string | null;
  range_end_raw: string | null;
  range_start_normalized: unknown | null;
  range_end_normalized: unknown | null;
  range_start_key: Buffer | null;
  range_end_key: Buffer | null;
}

export async function findScheme(
  database: Queryable,
  schemeId: number,
  lock = false,
): Promise<SchemeRow> {
  const result = await database.query<SchemeRow>(
    `SELECT scheme_id, name, status, short_description, is_active, enabled,
            published_at, created_at, updated_at
       FROM schemes
      WHERE scheme_id = $1${lock ? ' FOR UPDATE' : ''}`,
    [schemeId],
  );
  const scheme = result.rows[0];
  if (scheme === undefined) {
    throw new ApiError(404, 'SCHEME_NOT_FOUND', 'El esquema no existe.');
  }
  return scheme;
}

export async function findLevels(database: Queryable, schemeId: number): Promise<LevelRow[]> {
  const result = await database.query<LevelRow>(
    `SELECT scheme_level_id, parent_level_id, name, sort_order, is_search_terminal
       FROM scheme_levels
      WHERE scheme_id = $1
      ORDER BY scheme_level_id`,
    [schemeId],
  );
  return result.rows;
}

export async function findLocations(database: Queryable, schemeId: number): Promise<LocationRow[]> {
  const result = await database.query<LocationRow>(
    `SELECT l.location_id, l.parent_location_id, l.scheme_level_id,
            sl.name AS level_name, sl.is_search_terminal AS level_is_terminal,
            l.name, l.code, l.sort_order, l.range_start_raw, l.range_end_raw,
            l.range_start_normalized, l.range_end_normalized,
            l.range_start_key, l.range_end_key
       FROM locations AS l
       JOIN scheme_levels AS sl
         ON sl.scheme_id = l.scheme_id
        AND sl.scheme_level_id = l.scheme_level_id
      WHERE l.scheme_id = $1
      ORDER BY l.location_id`,
    [schemeId],
  );
  return result.rows;
}
