import {
  compareUnsignedBytes,
  encodeComparableKey,
  normalizeCallNumber,
  type NormalizedCallNumber,
} from '@bjff/call-number';
import type { Pool, PoolClient } from 'pg';

import { withTransaction, type Queryable } from '../db/transaction.js';
import { ApiError } from '../errors.js';
import {
  findLevels as getLevels,
  findLocations as getLocations,
  findScheme as getScheme,
  type LevelRow,
  type LocationRow,
  type SchemeRow,
} from './repository.js';

const INTERNAL_ROOT_NAME = '__system_root__';

export interface LevelInput {
  key: string;
  parentKey: string | null;
  name: string;
  sortOrder: number;
  isSearchTerminal: boolean;
}

export interface RangeInput {
  rangeStart: string;
  rangeEnd: string;
}

function schemeDto(row: SchemeRow) {
  return {
    schemeId: row.scheme_id,
    name: row.name,
    status: row.status,
    shortDescription: row.short_description,
    isActive: row.is_active,
    isPublished: row.published_at !== null,
    enabled: row.enabled,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function locationDto(row: LocationRow) {
  return {
    locationId: row.location_id,
    parentLocationId: row.parent_location_id,
    schemeLevelId: row.scheme_level_id,
    levelName: row.level_name,
    name: row.name,
    code: row.code,
    sortOrder: row.sort_order,
    isSearchTerminal: row.level_is_terminal,
    range: row.range_start_raw === null ? null : {
      start: row.range_start_raw,
      end: row.range_end_raw,
    },
  };
}

function ensureUnpublished(scheme: SchemeRow): void {
  if (scheme.published_at !== null || scheme.is_active) {
    throw new ApiError(
      409,
      'PUBLISHED_SCHEME_IMMUTABLE',
      'Un esquema publicado no se puede modificar; debe clonarse.',
    );
  }
}

async function getInternalRootLevel(database: Queryable, schemeId: number): Promise<LevelRow> {
  const result = await database.query<LevelRow>(
    `SELECT scheme_level_id, parent_level_id, name, sort_order, is_search_terminal
       FROM scheme_levels
      WHERE scheme_id = $1 AND parent_level_id IS NULL`,
    [schemeId],
  );
  const root = result.rows[0];
  if (root === undefined) {
    throw new ApiError(409, 'LEVELS_NOT_DEFINED', 'El esquema todavía no tiene niveles.');
  }
  return root;
}

function visibleLocations(rows: LocationRow[]): LocationRow[] {
  const root = rows.find((row) => row.parent_location_id === null);
  if (root === undefined) return rows;
  return rows.map((row) => row.parent_location_id === root.location_id
    ? { ...row, parent_location_id: null }
    : row).filter((row) => row.location_id !== root.location_id);
}

function buildRoutes(rows: LocationRow[]): Map<number, ReturnType<typeof locationDto>[]> {
  const byId = new Map(rows.map((row) => [row.location_id, row]));
  const root = rows.find((row) => row.parent_location_id === null);
  const routes = new Map<number, ReturnType<typeof locationDto>[]>();
  for (const row of rows) {
    const route: LocationRow[] = [];
    let current: LocationRow | undefined = row;
    const seen = new Set<number>();
    while (current !== undefined && !seen.has(current.location_id)) {
      seen.add(current.location_id);
      if (current.location_id !== root?.location_id) route.unshift(current);
      current = current.parent_location_id === null
        ? undefined
        : byId.get(current.parent_location_id);
    }
    routes.set(row.location_id, route.map(locationDto));
  }
  return routes;
}

function normalizeRange(input: RangeInput): {
  start: NormalizedCallNumber;
  end: NormalizedCallNumber;
  startKey: Buffer;
  endKey: Buffer;
} {
  const start = normalizeCallNumber(input.rangeStart);
  const end = normalizeCallNumber(input.rangeEnd);
  const issues = [
    ...start.issues.map((issue) => ({ endpoint: 'start', ...issue })),
    ...end.issues.map((issue) => ({ endpoint: 'end', ...issue })),
  ];
  if (start.status !== 'ok' || end.status !== 'ok') {
    throw new ApiError(422, 'INVALID_CALL_NUMBER_RANGE', 'El rango contiene una signatura inválida.', issues);
  }
  const startKey = Buffer.from(encodeComparableKey(start));
  const endKey = Buffer.from(encodeComparableKey(end));
  if (compareUnsignedBytes(startKey, endKey) > 0) {
    throw new ApiError(422, 'INVERTED_RANGE', 'El inicio del rango no puede ser mayor que el fin.');
  }
  return { start, end, startKey, endKey };
}

async function updateRangeState(client: PoolClient, schemeId: number): Promise<void> {
  const counts = await client.query<{ terminal_count: string; assigned_count: string }>(
    `SELECT count(*) AS terminal_count,
            count(*) FILTER (WHERE l.range_start_key IS NOT NULL) AS assigned_count
       FROM locations AS l
       JOIN scheme_levels AS sl
         ON sl.scheme_id = l.scheme_id
        AND sl.scheme_level_id = l.scheme_level_id
      WHERE l.scheme_id = $1 AND sl.is_search_terminal`,
    [schemeId],
  );
  const row = counts.rows[0];
  const terminalCount = Number(row?.terminal_count ?? 0);
  const assignedCount = Number(row?.assigned_count ?? 0);
  const current = await getScheme(client, schemeId, true);
  const desired = assignedCount === 0
    ? 'LOCATIONS_DEFINED'
    : assignedCount === terminalCount
      ? 'ASSIGNED'
      : 'PARTIALLY_ASSIGNED';

  if (current.status === desired) return;
  if (current.status === 'ASSIGNED' && desired === 'LOCATIONS_DEFINED') {
    await client.query(`UPDATE schemes SET status = 'PARTIALLY_ASSIGNED' WHERE scheme_id = $1`, [schemeId]);
  }
  await client.query('UPDATE schemes SET status = $2 WHERE scheme_id = $1', [schemeId, desired]);
}

export class SchemeService {
  constructor(private readonly pool: Pool) {}

  async listSchemes() {
    const result = await this.pool.query<SchemeRow & {
      level_count: string;
      location_count: string;
      assigned_range_count: string;
      terminal_count: string;
    }>(
      `SELECT s.scheme_id, s.name, s.status, s.short_description, s.is_active,
              s.enabled, s.published_at, s.created_at, s.updated_at,
              count(DISTINCT sl.scheme_level_id) FILTER (WHERE sl.parent_level_id IS NOT NULL) AS level_count,
              count(DISTINCT l.location_id) FILTER (WHERE l.parent_location_id IS NOT NULL) AS location_count,
              count(DISTINCT l.location_id) FILTER (WHERE l.range_start_key IS NOT NULL) AS assigned_range_count,
              count(DISTINCT l.location_id) FILTER (WHERE sl.is_search_terminal) AS terminal_count
         FROM schemes AS s
         LEFT JOIN scheme_levels AS sl ON sl.scheme_id = s.scheme_id
         LEFT JOIN locations AS l
           ON l.scheme_id = s.scheme_id AND l.scheme_level_id = sl.scheme_level_id
        GROUP BY s.scheme_id
        ORDER BY s.is_active DESC, s.updated_at DESC, s.scheme_id DESC`,
    );
    return result.rows.map((row) => ({
      ...schemeDto(row),
      counts: {
        levels: Number(row.level_count),
        locations: Number(row.location_count),
        assignedRanges: Number(row.assigned_range_count),
        terminalLocations: Number(row.terminal_count),
      },
    }));
  }

  async createScheme(actorId: number, input: { name: string; shortDescription?: string | null | undefined }) {
    const result = await this.pool.query<SchemeRow>(
      `INSERT INTO schemes (name, short_description, ordering_profile_id, created_by)
       SELECT $1, $2, ordering_profile_id, $3
         FROM ordering_profiles
        WHERE lower(name) = 'ddc-base-v1' AND enabled
        RETURNING scheme_id, name, status, short_description, is_active, enabled,
                  published_at, created_at, updated_at`,
      [input.name, input.shortDescription ?? null, actorId],
    );
    const scheme = result.rows[0];
    if (scheme === undefined) {
      throw new ApiError(500, 'ORDERING_PROFILE_NOT_CONFIGURED', 'El perfil ddc-base-v1 no está disponible.');
    }
    return schemeDto(scheme);
  }

  async getSchemeDetail(schemeId: number) {
    const scheme = await getScheme(this.pool, schemeId);
    const [levels, locations] = await Promise.all([
      this.getLevels(schemeId),
      this.getLocations(schemeId),
    ]);
    return { ...schemeDto(scheme), levels, locations };
  }

  async updateScheme(schemeId: number, input: { name?: string | undefined; shortDescription?: string | null | undefined }) {
    return withTransaction(this.pool, async (client) => {
      const scheme = await getScheme(client, schemeId, true);
      ensureUnpublished(scheme);
      const result = await client.query<SchemeRow>(
        `UPDATE schemes
            SET name = COALESCE($2, name),
                short_description = CASE WHEN $3 THEN $4 ELSE short_description END
          WHERE scheme_id = $1
        RETURNING scheme_id, name, status, short_description, is_active, enabled,
                  published_at, created_at, updated_at`,
        [schemeId, input.name ?? null, Object.hasOwn(input, 'shortDescription'), input.shortDescription ?? null],
      );
      return schemeDto(result.rows[0] as SchemeRow);
    });
  }

  async getLevels(schemeId: number) {
    await getScheme(this.pool, schemeId);
    const rows = await getLevels(this.pool, schemeId);
    const root = rows.find((row) => row.parent_level_id === null);
    return rows.filter((row) => row.scheme_level_id !== root?.scheme_level_id).map((row) => ({
      schemeLevelId: row.scheme_level_id,
      parentLevelId: row.parent_level_id === root?.scheme_level_id ? null : row.parent_level_id,
      name: row.name,
      sortOrder: row.sort_order,
      isSearchTerminal: row.is_search_terminal,
    }));
  }

  async replaceLevels(schemeId: number, levels: LevelInput[]) {
    return withTransaction(this.pool, async (client) => {
      const scheme = await getScheme(client, schemeId, true);
      ensureUnpublished(scheme);
      if (scheme.status !== 'DRAFT') {
        throw new ApiError(409, 'LEVELS_NOT_EDITABLE', 'Los niveles solo se editan en DRAFT.');
      }
      const keys = new Set(levels.map((level) => level.key));
      if (keys.size !== levels.length || levels.filter((level) => level.parentKey === null).length !== 1) {
        throw new ApiError(422, 'INVALID_LEVEL_TREE', 'Los niveles requieren claves únicas y una sola raíz física.');
      }
      if (levels.some((level) => level.parentKey !== null && !keys.has(level.parentKey))) {
        throw new ApiError(422, 'INVALID_LEVEL_TREE', 'Todos los padres deben existir en la definición.');
      }

      const existing = await getLevels(client, schemeId);
      const pendingDelete = new Set(existing.map((row) => row.scheme_level_id));
      while (pendingDelete.size > 0) {
        const deletable = existing.filter((row) => pendingDelete.has(row.scheme_level_id)
          && !existing.some((candidate) => pendingDelete.has(candidate.scheme_level_id)
            && candidate.parent_level_id === row.scheme_level_id));
        if (deletable.length === 0) break;
        for (const row of deletable) {
          await client.query('DELETE FROM scheme_levels WHERE scheme_level_id = $1', [row.scheme_level_id]);
          pendingDelete.delete(row.scheme_level_id);
        }
      }

      const rootResult = await client.query<{ scheme_level_id: number }>(
        `INSERT INTO scheme_levels (scheme_id, parent_level_id, name, sort_order, is_search_terminal)
         VALUES ($1, NULL, $2, 0, false)
         RETURNING scheme_level_id`,
        [schemeId, INTERNAL_ROOT_NAME],
      );
      const rootId = (rootResult.rows[0] as { scheme_level_id: number }).scheme_level_id;
      const inserted = new Map<string, number>();
      const pending = [...levels];
      while (pending.length > 0) {
        const index = pending.findIndex((level) => level.parentKey === null || inserted.has(level.parentKey));
        if (index < 0) {
          throw new ApiError(422, 'INVALID_LEVEL_TREE', 'La definición de niveles contiene un ciclo.');
        }
        const [level] = pending.splice(index, 1);
        if (level === undefined) continue;
        const parentId = level.parentKey === null ? rootId : inserted.get(level.parentKey);
        const result = await client.query<{ scheme_level_id: number }>(
          `INSERT INTO scheme_levels
             (scheme_id, parent_level_id, name, sort_order, is_search_terminal)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING scheme_level_id`,
          [schemeId, parentId, level.name, level.sortOrder, level.isSearchTerminal],
        );
        inserted.set(level.key, (result.rows[0] as { scheme_level_id: number }).scheme_level_id);
      }
      return this.getLevelsWith(client, schemeId);
    });
  }

  private async getLevelsWith(database: Queryable, schemeId: number) {
    const rows = await getLevels(database, schemeId);
    const root = rows.find((row) => row.parent_level_id === null);
    return rows.filter((row) => row.scheme_level_id !== root?.scheme_level_id).map((row) => ({
      schemeLevelId: row.scheme_level_id,
      parentLevelId: row.parent_level_id === root?.scheme_level_id ? null : row.parent_level_id,
      name: row.name,
      sortOrder: row.sort_order,
      isSearchTerminal: row.is_search_terminal,
    }));
  }

  async confirmLevels(schemeId: number, actorId: number) {
    return withTransaction(this.pool, async (client) => {
      const scheme = await getScheme(client, schemeId, true);
      ensureUnpublished(scheme);
      if (scheme.status !== 'DRAFT') {
        throw new ApiError(409, 'LEVELS_ALREADY_CONFIRMED', 'Los niveles ya fueron confirmados.');
      }
      const root = await getInternalRootLevel(client, schemeId);
      await client.query(`UPDATE schemes SET status = 'LEVELS_DEFINED' WHERE scheme_id = $1`, [schemeId]);
      await client.query(
        `INSERT INTO locations
           (scheme_id, parent_location_id, scheme_level_id, name, code, sort_order, created_by, updated_by)
         VALUES ($1, NULL, $2, $3, $4, 0, $5, $5)`,
        [schemeId, root.scheme_level_id, INTERNAL_ROOT_NAME, String(schemeId), actorId],
      );
      return schemeDto(await getScheme(client, schemeId));
    });
  }

  async getLocations(schemeId: number) {
    await getScheme(this.pool, schemeId);
    const rows = visibleLocations(await getLocations(this.pool, schemeId));
    return rows.map(locationDto);
  }

  async addLocations(
    schemeId: number,
    actorId: number,
    input: { parentLocationId: number | null; schemeLevelId?: number | undefined; quantity: number },
  ) {
    return withTransaction(this.pool, async (client) => {
      const scheme = await getScheme(client, schemeId, true);
      ensureUnpublished(scheme);
      if (scheme.status !== 'LEVELS_DEFINED') {
        throw new ApiError(409, 'LOCATIONS_NOT_EDITABLE', 'Las ubicaciones no están abiertas para edición.');
      }
      const parentResult = input.parentLocationId === null
        ? await client.query<{ location_id: number; scheme_level_id: number; code: string }>(
            'SELECT location_id, scheme_level_id, code FROM locations WHERE scheme_id = $1 AND parent_location_id IS NULL',
            [schemeId],
          )
        : await client.query<{ location_id: number; scheme_level_id: number; code: string }>(
            'SELECT location_id, scheme_level_id, code FROM locations WHERE scheme_id = $1 AND location_id = $2',
            [schemeId, input.parentLocationId],
          );
      const parent = parentResult.rows[0];
      if (parent === undefined) {
        throw new ApiError(404, 'PARENT_LOCATION_NOT_FOUND', 'La ubicación padre no existe.');
      }
      const childLevels = await client.query<LevelRow>(
        `SELECT scheme_level_id, parent_level_id, name, sort_order, is_search_terminal
           FROM scheme_levels
          WHERE scheme_id = $1 AND parent_level_id = $2
          ORDER BY sort_order, scheme_level_id`,
        [schemeId, parent.scheme_level_id],
      );
      const candidates = input.schemeLevelId === undefined
        ? childLevels.rows
        : childLevels.rows.filter((row) => row.scheme_level_id === input.schemeLevelId);
      if (candidates.length !== 1) {
        throw new ApiError(
          422,
          'CHILD_LEVEL_REQUIRED',
          childLevels.rows.length === 0
            ? 'La ubicación no admite más niveles descendientes.'
            : 'Debe indicar cuál nivel hijo desea materializar.',
        );
      }
      const childLevel = candidates[0] as LevelRow;
      const orderResult = await client.query<{ next_order: number }>(
        `SELECT COALESCE(max(sort_order), 0) + 1 AS next_order
           FROM locations
          WHERE scheme_id = $1 AND parent_location_id = $2`,
        [schemeId, parent.location_id],
      );
      const firstOrder = Number(orderResult.rows[0]?.next_order ?? 1);
      const created: LocationRow[] = [];
      for (let offset = 0; offset < input.quantity; offset += 1) {
        const sortOrder = firstOrder + offset;
        const result = await client.query<LocationRow>(
          `INSERT INTO locations
             (scheme_id, parent_location_id, scheme_level_id, name, code, sort_order, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
           RETURNING location_id, parent_location_id, scheme_level_id,
                     $8::text AS level_name, $9::boolean AS level_is_terminal,
                     name, code, sort_order, range_start_raw, range_end_raw,
                     range_start_normalized, range_end_normalized,
                     range_start_key, range_end_key`,
          [
            schemeId,
            parent.location_id,
            childLevel.scheme_level_id,
            `${childLevel.name} ${sortOrder}`,
            `${parent.code}-${sortOrder}`,
            sortOrder,
            actorId,
            childLevel.name,
            childLevel.is_search_terminal,
          ],
        );
        created.push(result.rows[0] as LocationRow);
      }
      return created.map((row) => locationDto({
        ...row,
        parent_location_id: input.parentLocationId,
      }));
    });
  }

  async deleteLocation(schemeId: number, locationId: number) {
    return withTransaction(this.pool, async (client) => {
      const scheme = await getScheme(client, schemeId, true);
      ensureUnpublished(scheme);
      if (scheme.status !== 'LEVELS_DEFINED') {
        throw new ApiError(409, 'LOCATIONS_NOT_EDITABLE', 'Las ubicaciones no están abiertas para edición.');
      }
      const rows = await client.query<{ location_id: number; depth: number; parent_location_id: number | null }>(
        `WITH RECURSIVE subtree AS (
           SELECT location_id, parent_location_id, 0 AS depth
             FROM locations
            WHERE scheme_id = $1 AND location_id = $2
           UNION ALL
           SELECT child.location_id, child.parent_location_id, parent.depth + 1
             FROM locations AS child
             JOIN subtree AS parent ON child.parent_location_id = parent.location_id
            WHERE child.scheme_id = $1
         )
         SELECT * FROM subtree ORDER BY depth DESC`,
        [schemeId, locationId],
      );
      if (rows.rows.length === 0) {
        throw new ApiError(404, 'LOCATION_NOT_FOUND', 'La ubicación no existe.');
      }
      if (rows.rows.some((row) => row.parent_location_id === null)) {
        throw new ApiError(409, 'INTERNAL_ROOT_IMMUTABLE', 'La raíz interna no se puede eliminar.');
      }
      for (const row of rows.rows) {
        await client.query('DELETE FROM locations WHERE location_id = $1', [row.location_id]);
      }
      return { deletedLocationIds: rows.rows.map((row) => row.location_id) };
    });
  }

  async confirmLocations(schemeId: number) {
    return withTransaction(this.pool, async (client) => {
      const scheme = await getScheme(client, schemeId, true);
      ensureUnpublished(scheme);
      if (scheme.status !== 'LEVELS_DEFINED') {
        throw new ApiError(409, 'LOCATIONS_ALREADY_CONFIRMED', 'Las ubicaciones ya fueron confirmadas.');
      }
      await client.query(`UPDATE schemes SET status = 'LOCATIONS_DEFINED' WHERE scheme_id = $1`, [schemeId]);
      return schemeDto(await getScheme(client, schemeId));
    });
  }

  async reopenLocations(schemeId: number) {
    return withTransaction(this.pool, async (client) => {
      const scheme = await getScheme(client, schemeId, true);
      ensureUnpublished(scheme);
      if (scheme.status === 'DRAFT') {
        throw new ApiError(409, 'LEVELS_NOT_CONFIRMED', 'El esquema todavía está en DRAFT.');
      }
      if (scheme.status === 'ASSIGNED') {
        await client.query(`UPDATE schemes SET status = 'PARTIALLY_ASSIGNED' WHERE scheme_id = $1`, [schemeId]);
      }
      if (scheme.status === 'ASSIGNED' || scheme.status === 'PARTIALLY_ASSIGNED') {
        await client.query(
          `UPDATE locations
              SET range_start_raw = NULL, range_end_raw = NULL,
                  range_start_normalized = NULL, range_end_normalized = NULL,
                  range_start_key = NULL, range_end_key = NULL
            WHERE scheme_id = $1 AND range_start_key IS NOT NULL`,
          [schemeId],
        );
      }
      await client.query('DELETE FROM map_layers WHERE scheme_id = $1', [schemeId]);
      const current = await getScheme(client, schemeId);
      if (current.status === 'PARTIALLY_ASSIGNED') {
        await client.query(`UPDATE schemes SET status = 'LOCATIONS_DEFINED' WHERE scheme_id = $1`, [schemeId]);
      }
      if ((await getScheme(client, schemeId)).status === 'LOCATIONS_DEFINED') {
        await client.query(`UPDATE schemes SET status = 'LEVELS_DEFINED' WHERE scheme_id = $1`, [schemeId]);
      }
      return schemeDto(await getScheme(client, schemeId));
    });
  }

  async reopenLevels(schemeId: number) {
    return withTransaction(this.pool, async (client) => {
      let scheme = await getScheme(client, schemeId, true);
      ensureUnpublished(scheme);
      if (scheme.status === 'DRAFT') return schemeDto(scheme);

      if (scheme.status === 'ASSIGNED') {
        await client.query(`UPDATE schemes SET status = 'PARTIALLY_ASSIGNED' WHERE scheme_id = $1`, [schemeId]);
      }
      scheme = await getScheme(client, schemeId);
      if (scheme.status === 'PARTIALLY_ASSIGNED') {
        await client.query(
          `UPDATE locations SET range_start_raw = NULL, range_end_raw = NULL,
             range_start_normalized = NULL, range_end_normalized = NULL,
             range_start_key = NULL, range_end_key = NULL
           WHERE scheme_id = $1 AND range_start_key IS NOT NULL`,
          [schemeId],
        );
      }
      await client.query('DELETE FROM map_layers WHERE scheme_id = $1', [schemeId]);
      if ((await getScheme(client, schemeId)).status === 'PARTIALLY_ASSIGNED') {
        await client.query(`UPDATE schemes SET status = 'LOCATIONS_DEFINED' WHERE scheme_id = $1`, [schemeId]);
      }
      if ((await getScheme(client, schemeId)).status === 'LOCATIONS_DEFINED') {
        await client.query(`UPDATE schemes SET status = 'LEVELS_DEFINED' WHERE scheme_id = $1`, [schemeId]);
      }
      const locations = await getLocations(client, schemeId);
      const pending = new Set(locations.map((row) => row.location_id));
      while (pending.size > 0) {
        const deletable = locations.filter((row) => pending.has(row.location_id)
          && !locations.some((candidate) => pending.has(candidate.location_id)
            && candidate.parent_location_id === row.location_id));
        for (const row of deletable) {
          await client.query('DELETE FROM locations WHERE location_id = $1', [row.location_id]);
          pending.delete(row.location_id);
        }
      }
      await client.query(`UPDATE schemes SET status = 'DRAFT' WHERE scheme_id = $1`, [schemeId]);
      return schemeDto(await getScheme(client, schemeId));
    });
  }

  async getRanges(schemeId: number) {
    await getScheme(this.pool, schemeId);
    const rows = await getLocations(this.pool, schemeId);
    const visible = visibleLocations(rows);
    const routes = buildRoutes(rows);
    const children = new Map<number, number[]>();
    for (const row of rows) {
      if (row.parent_location_id !== null) {
        const items = children.get(row.parent_location_id) ?? [];
        items.push(row.location_id);
        children.set(row.parent_location_id, items);
      }
    }
    const byId = new Map(rows.map((row) => [row.location_id, row]));
    const terminalDescendants = (id: number): LocationRow[] => {
      const row = byId.get(id);
      if (row?.level_is_terminal) return [row];
      return (children.get(id) ?? []).flatMap(terminalDescendants);
    };
    return visible.map((row) => {
      const terminals = terminalDescendants(row.location_id);
      const assigned = terminals.filter((terminal) => terminal.range_start_key !== null);
      const start = assigned.reduce<LocationRow | null>((current, candidate) => {
        if (candidate.range_start_key === null) return current;
        if (current?.range_start_key === null || current === null) return candidate;
        return Buffer.compare(candidate.range_start_key, current.range_start_key) < 0 ? candidate : current;
      }, null);
      const end = assigned.reduce<LocationRow | null>((current, candidate) => {
        if (candidate.range_end_key === null) return current;
        if (current?.range_end_key === null || current === null) return candidate;
        return Buffer.compare(candidate.range_end_key, current.range_end_key) > 0 ? candidate : current;
      }, null);
      return {
        ...locationDto(row),
        route: routes.get(row.location_id) ?? [],
        coverage: {
          complete: terminals.length > 0 && assigned.length === terminals.length,
          terminalCount: terminals.length,
          assignedCount: assigned.length,
          start: start?.range_start_raw ?? null,
          end: end?.range_end_raw ?? null,
        },
      };
    });
  }

  async setRange(schemeId: number, locationId: number, actorId: number, input: RangeInput) {
    return this.setRanges(schemeId, actorId, [{ locationId, ...input }]);
  }

  async setRanges(
    schemeId: number,
    actorId: number,
    inputs: Array<RangeInput & { locationId: number }>,
  ) {
    if (new Set(inputs.map((input) => input.locationId)).size !== inputs.length) {
      throw new ApiError(400, 'DUPLICATE_RANGE_LOCATION', 'Una carga no puede repetir la misma ubicación.');
    }
    const normalized = inputs.map((input) => ({ input, normalized: normalizeRange(input) }));
    return withTransaction(this.pool, async (client) => {
      const scheme = await getScheme(client, schemeId, true);
      ensureUnpublished(scheme);
      if (!['LOCATIONS_DEFINED', 'PARTIALLY_ASSIGNED', 'ASSIGNED'].includes(scheme.status)) {
        throw new ApiError(409, 'RANGES_NOT_EDITABLE', 'Los rangos requieren ubicaciones confirmadas.');
      }
      if (scheme.status === 'LOCATIONS_DEFINED') {
        await client.query(`UPDATE schemes SET status = 'PARTIALLY_ASSIGNED' WHERE scheme_id = $1`, [schemeId]);
      }
      for (const item of normalized) {
        const result = await client.query(
          `UPDATE locations AS l
              SET range_start_raw = $3, range_end_raw = $4,
                  range_start_normalized = $5::jsonb, range_end_normalized = $6::jsonb,
                  range_start_key = $7, range_end_key = $8, updated_by = $9
             FROM scheme_levels AS sl
            WHERE l.scheme_id = $1 AND l.location_id = $2
              AND sl.scheme_id = l.scheme_id
              AND sl.scheme_level_id = l.scheme_level_id
              AND sl.is_search_terminal`,
          [
            schemeId,
            item.input.locationId,
            item.input.rangeStart,
            item.input.rangeEnd,
            JSON.stringify(item.normalized.start),
            JSON.stringify(item.normalized.end),
            item.normalized.startKey,
            item.normalized.endKey,
            actorId,
          ],
        );
        if (result.rowCount !== 1) {
          throw new ApiError(422, 'LOCATION_NOT_SEARCH_TERMINAL', 'El rango solo puede asignarse a una ubicación terminal.');
        }
      }
      await updateRangeState(client, schemeId);
      return this.getRangesWith(client, schemeId);
    });
  }

  private async getRangesWith(database: Queryable, schemeId: number) {
    const rows = visibleLocations(await getLocations(database, schemeId));
    return rows.filter((row) => row.level_is_terminal).map(locationDto);
  }

  async deleteRange(schemeId: number, locationId: number, actorId: number) {
    return withTransaction(this.pool, async (client) => {
      const scheme = await getScheme(client, schemeId, true);
      ensureUnpublished(scheme);
      if (!['PARTIALLY_ASSIGNED', 'ASSIGNED'].includes(scheme.status)) {
        throw new ApiError(409, 'RANGES_NOT_ASSIGNED', 'La ubicación no tiene un rango editable.');
      }
      if (scheme.status === 'ASSIGNED') {
        await client.query(`UPDATE schemes SET status = 'PARTIALLY_ASSIGNED' WHERE scheme_id = $1`, [schemeId]);
      }
      const result = await client.query(
        `UPDATE locations
            SET range_start_raw = NULL, range_end_raw = NULL,
                range_start_normalized = NULL, range_end_normalized = NULL,
                range_start_key = NULL, range_end_key = NULL, updated_by = $3
          WHERE scheme_id = $1 AND location_id = $2 AND range_start_key IS NOT NULL`,
        [schemeId, locationId, actorId],
      );
      if (result.rowCount !== 1) {
        throw new ApiError(404, 'RANGE_NOT_FOUND', 'La ubicación no tiene un rango asignado.');
      }
      await updateRangeState(client, schemeId);
      return { locationId, deleted: true };
    });
  }

  async exportLocationsCsv(schemeId: number, levelId?: number): Promise<string> {
    await getScheme(this.pool, schemeId);
    const [locationRows, levelRows] = await Promise.all([
      getLocations(this.pool, schemeId),
      getLevels(this.pool, schemeId),
    ]);
    if (levelId !== undefined && !levelRows.some((level) => (
      level.scheme_level_id === levelId && level.parent_level_id !== null
    ))) {
      throw new ApiError(422, 'INVALID_CSV_LEVEL', 'El nivel solicitado no pertenece al esquema.');
    }
    const rows = visibleLocations(locationRows);
    const byId = new Map(rows.map((row) => [row.location_id, row]));
    const routeFor = (row: LocationRow) => {
      const route: LocationRow[] = [];
      const visited = new Set<number>();
      let current: LocationRow | undefined = row;
      while (current !== undefined && !visited.has(current.location_id)) {
        visited.add(current.location_id);
        route.unshift(current);
        current = current.parent_location_id === null
          ? undefined
          : byId.get(current.parent_location_id);
      }
      return route;
    };
    const exportRows = rows.map((row) => {
      const route = routeFor(row);
      return { row, route, order: route.map((item) => item.sort_order) };
    }).filter((item) => levelId === undefined || item.row.scheme_level_id === levelId);
    exportRows.sort((left, right) => {
      const length = Math.min(left.order.length, right.order.length);
      for (let index = 0; index < length; index += 1) {
        const difference = (left.order[index] as number) - (right.order[index] as number);
        if (difference !== 0) return difference;
      }
      return left.order.length - right.order.length;
    });
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    return `\uFEFF${[
      ['location_code', 'level_name', 'full_path', 'parent_code', 'name', 'sort_order'],
      ...exportRows.map(({ row, route }) => [
        row.code,
        row.level_name,
        route.map((item) => item.name).join(' / '),
        row.parent_location_id === null ? '' : (byId.get(row.parent_location_id)?.code ?? ''),
        row.name,
        row.sort_order,
      ]),
    ].map((row) => row.map(quote).join(';')).join('\r\n')}`;
  }

  async searchText(schemeId: number, callNumber: string) {
    const scheme = await getScheme(this.pool, schemeId);
    const normalized = normalizeCallNumber(callNumber);
    if (normalized.status !== 'ok') {
      throw new ApiError(422, 'INVALID_CALL_NUMBER', 'La signatura no se pudo interpretar.', normalized.issues);
    }
    const key = Buffer.from(encodeComparableKey(normalized));
    const matches = await this.pool.query<LocationRow>(
      `SELECT l.location_id, l.parent_location_id, l.scheme_level_id,
              sl.name AS level_name, sl.is_search_terminal AS level_is_terminal,
              l.name, l.code, l.sort_order, l.range_start_raw, l.range_end_raw,
              l.range_start_normalized, l.range_end_normalized,
              l.range_start_key, l.range_end_key
         FROM locations AS l
         JOIN scheme_levels AS sl
           ON sl.scheme_id = l.scheme_id AND sl.scheme_level_id = l.scheme_level_id
        WHERE l.scheme_id = $1
          AND l.range_start_key <= $2
          AND l.range_end_key >= $2
        ORDER BY l.code`,
      [schemeId, key],
    );
    const rows = await getLocations(this.pool, schemeId);
    const routes = buildRoutes(rows);
    return {
      scheme: schemeDto(scheme),
      query: { raw: callNumber, normalized, comparableKeyVersion: 1 },
      matches: matches.rows.map((row) => ({
        ...locationDto(row),
        route: routes.get(row.location_id) ?? [],
      })),
    };
  }
}

export { ensureUnpublished, schemeDto, locationDto, buildRoutes, visibleLocations, INTERNAL_ROOT_NAME };
