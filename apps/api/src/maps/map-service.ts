import type { Pool, PoolClient } from 'pg';

import { withTransaction, type Queryable } from '../db/transaction.js';
import { ApiError } from '../errors.js';
import {
  buildRoutes,
  ensureUnpublished,
  locationDto,
  schemeDto,
  visibleLocations,
} from '../admin/scheme-service.js';
import {
  findLevels as getLevels,
  findLocations as getLocations,
  findScheme as getScheme,
  type LevelRow,
  type LocationRow,
  type SchemeRow,
} from '../admin/repository.js';
import { sanitizeSvg, validateFrontSvg, validateTopSvg } from './svg.js';
import { SvgStorage } from './storage.js';
import {
  findMapSnapshot as getMapSnapshot,
  type LayerRow,
  type MapSnapshot,
  type SvgRow,
} from './repository.js';

function snapshotDto(snapshot: MapSnapshot) {
  return snapshot.layers.map((layer) => ({
    mapLayerId: layer.map_layer_id,
    name: layer.name,
    viewType: layer.view_type,
    renderMode: layer.render_mode,
    enabled: layer.enabled,
    representedLevels: snapshot.levels.filter((row) => row.map_layer_id === layer.map_layer_id).map((row) => ({
      schemeLevelId: row.scheme_level_id,
      drilldownMapLayerId: row.drilldown_map_layer_id,
    })),
    svgs: snapshot.svgs.filter((row) => row.map_layer_id === layer.map_layer_id).map((row) => ({
      mapLayerSvgId: row.map_layer_svg_id,
      name: row.name,
      variantCode: row.variant_code,
      assetUrl: row.asset_url,
      slotCount: row.slot_count,
      enabled: row.enabled,
    })),
    assignments: snapshot.assignments.filter((row) => row.map_layer_id === layer.map_layer_id).map((row) => ({
      mapLayerSvgId: row.map_layer_svg_id,
      contextLocationId: row.context_location_id,
    })),
  }));
}

async function assertMapEditable(database: Queryable, schemeId: number): Promise<SchemeRow> {
  const scheme = await getScheme(database, schemeId, true);
  ensureUnpublished(scheme);
  if (!['LOCATIONS_DEFINED', 'PARTIALLY_ASSIGNED', 'ASSIGNED'].includes(scheme.status)) {
    throw new ApiError(409, 'MAPS_NOT_EDITABLE', 'Los mapas requieren ubicaciones confirmadas.');
  }
  return scheme;
}

async function requireLayer(
  database: Queryable,
  schemeId: number,
  layerId: number,
  viewType?: 'TOP' | 'FRONT',
): Promise<LayerRow> {
  const result = await database.query<LayerRow>(
    `SELECT map_layer_id, scheme_id, name, view_type, render_mode, enabled
       FROM map_layers WHERE scheme_id = $1 AND map_layer_id = $2`,
    [schemeId, layerId],
  );
  const layer = result.rows[0];
  if (layer === undefined || (viewType !== undefined && layer.view_type !== viewType)) {
    throw new ApiError(404, 'MAP_LAYER_NOT_FOUND', 'La capa de mapa no existe.');
  }
  return layer;
}

function pathForLocation(locationId: number, rows: LocationRow[]): LocationRow[] {
  const byId = new Map(rows.map((row) => [row.location_id, row]));
  const result: LocationRow[] = [];
  let current = byId.get(locationId);
  const seen = new Set<number>();
  while (current !== undefined && !seen.has(current.location_id)) {
    seen.add(current.location_id);
    result.unshift(current);
    current = current.parent_location_id === null ? undefined : byId.get(current.parent_location_id);
  }
  return result;
}

export interface MapReadiness {
  ready: boolean;
  top: {
    layerCount: number;
    coveredTerminalCount: number;
    terminalCount: number;
    missingLocationCodes: string[];
  };
  front: {
    layerCount: number;
    missingAssignmentCount: number;
    unlinkedLayerCount: number;
  };
  blockers: Array<{ code: string; message: string }>;
}

export class MapService {
  constructor(
    private readonly pool: Pool,
    private readonly storage: SvgStorage,
  ) {}

  async getMaps(schemeId: number) {
    await getScheme(this.pool, schemeId);
    return snapshotDto(await getMapSnapshot(this.pool, schemeId));
  }

  async getAssetUrls(schemeId: number): Promise<string[]> {
    return (await getMapSnapshot(this.pool, schemeId)).svgs.map((svg) => svg.asset_url);
  }

  async removeAssetsBestEffort(assetUrls: string[]): Promise<void> {
    await Promise.all(assetUrls.map(async (assetUrl) => {
      try {
        await this.storage.remove(assetUrl);
      } catch (error) {
        console.error(`No se pudo retirar el recurso local ${assetUrl}.`, error);
      }
    }));
  }

  async createTopLayer(
    schemeId: number,
    metadata: { name: string; svgName: string; representedLevelIds: number[] },
    rawSvg: string,
  ) {
    const scheme = await getScheme(this.pool, schemeId);
    ensureUnpublished(scheme);
    if (!['LOCATIONS_DEFINED', 'PARTIALLY_ASSIGNED', 'ASSIGNED'].includes(scheme.status)) {
      throw new ApiError(409, 'MAPS_NOT_EDITABLE', 'Los mapas requieren ubicaciones confirmadas.');
    }
    const sanitized = sanitizeSvg(rawSvg);
    const locations = visibleLocations(await getLocations(this.pool, schemeId));
    validateTopSvg(sanitized, new Set(locations.map((row) => row.code)));
    const assetUrl = await this.storage.write(schemeId, sanitized.source);
    try {
      return await withTransaction(this.pool, async (client) => {
        await assertMapEditable(client, schemeId);
        const levelCount = await client.query<{ count: string }>(
          `SELECT count(*) FROM scheme_levels
            WHERE scheme_id = $1 AND parent_level_id IS NOT NULL
              AND scheme_level_id = ANY($2::int[])`,
          [schemeId, metadata.representedLevelIds],
        );
        if (Number(levelCount.rows[0]?.count ?? 0) !== new Set(metadata.representedLevelIds).size) {
          throw new ApiError(422, 'INVALID_REPRESENTED_LEVEL', 'Todos los niveles representados deben pertenecer al esquema.');
        }
        const layerResult = await client.query<{ map_layer_id: number }>(
          `INSERT INTO map_layers (scheme_id, name, view_type, render_mode)
           VALUES ($1, $2, 'TOP', 'STATIC') RETURNING map_layer_id`,
          [schemeId, metadata.name],
        );
        const layerId = (layerResult.rows[0] as { map_layer_id: number }).map_layer_id;
        for (const levelId of new Set(metadata.representedLevelIds)) {
          await client.query(
            'INSERT INTO map_layer_scheme_levels (map_layer_id, scheme_level_id) VALUES ($1, $2)',
            [layerId, levelId],
          );
        }
        const svgResult = await client.query<{ map_layer_svg_id: number }>(
          `INSERT INTO map_layer_svgs (map_layer_id, name, asset_url)
           VALUES ($1, $2, $3) RETURNING map_layer_svg_id`,
          [layerId, metadata.svgName, assetUrl],
        );
        return {
          mapLayerId: layerId,
          mapLayerSvgId: (svgResult.rows[0] as { map_layer_svg_id: number }).map_layer_svg_id,
          assetUrl,
          removedItems: sanitized.removedItems,
        };
      });
    } catch (error) {
      await this.storage.remove(assetUrl);
      throw error;
    }
  }

  async createFrontLayer(schemeId: number, input: { name: string; representedLevelId: number }) {
    return withTransaction(this.pool, async (client) => {
      await assertMapEditable(client, schemeId);
      const level = await client.query(
        'SELECT 1 FROM scheme_levels WHERE scheme_id = $1 AND scheme_level_id = $2 AND parent_level_id IS NOT NULL',
        [schemeId, input.representedLevelId],
      );
      if (level.rowCount !== 1) {
        throw new ApiError(422, 'INVALID_REPRESENTED_LEVEL', 'El nivel frontal no pertenece al esquema.');
      }
      const result = await client.query<{ map_layer_id: number }>(
        `INSERT INTO map_layers (scheme_id, name, view_type, render_mode)
         VALUES ($1, $2, 'FRONT', 'TEMPLATE') RETURNING map_layer_id`,
        [schemeId, input.name],
      );
      const layerId = (result.rows[0] as { map_layer_id: number }).map_layer_id;
      await client.query(
        'INSERT INTO map_layer_scheme_levels (map_layer_id, scheme_level_id) VALUES ($1, $2)',
        [layerId, input.representedLevelId],
      );
      return { mapLayerId: layerId, ...input };
    });
  }

  async addFrontVariant(
    schemeId: number,
    layerId: number,
    metadata: { name: string; variantCode: string; slotCount: number },
    rawSvg: string,
  ) {
    const sanitized = sanitizeSvg(rawSvg);
    validateFrontSvg(sanitized, metadata.slotCount);
    const assetUrl = await this.storage.write(schemeId, sanitized.source);
    try {
      return await withTransaction(this.pool, async (client) => {
        await assertMapEditable(client, schemeId);
        await requireLayer(client, schemeId, layerId, 'FRONT');
        const result = await client.query<{ map_layer_svg_id: number }>(
          `INSERT INTO map_layer_svgs
             (map_layer_id, name, variant_code, asset_url, slot_count)
           VALUES ($1, $2, $3, $4, $5) RETURNING map_layer_svg_id`,
          [layerId, metadata.name, metadata.variantCode, assetUrl, metadata.slotCount],
        );
        return {
          mapLayerSvgId: (result.rows[0] as { map_layer_svg_id: number }).map_layer_svg_id,
          assetUrl,
          removedItems: sanitized.removedItems,
          ...metadata,
        };
      });
    } catch (error) {
      await this.storage.remove(assetUrl);
      throw error;
    }
  }

  async replaceSvg(
    schemeId: number,
    svgId: number,
    metadata: { name?: string | undefined; variantCode?: string | undefined; slotCount?: number | undefined; enabled?: boolean | undefined },
    rawSvg?: string,
  ) {
    const existingResult = await this.pool.query<SvgRow & { view_type: LayerRow['view_type'] }>(
      `SELECT svg.map_layer_svg_id, svg.map_layer_id, svg.name, svg.variant_code,
              svg.asset_url, svg.slot_count, svg.enabled, ml.view_type
         FROM map_layer_svgs AS svg
         JOIN map_layers AS ml ON ml.map_layer_id = svg.map_layer_id
        WHERE ml.scheme_id = $1 AND svg.map_layer_svg_id = $2`,
      [schemeId, svgId],
    );
    const existing = existingResult.rows[0];
    if (existing === undefined) {
      throw new ApiError(404, 'MAP_SVG_NOT_FOUND', 'El SVG no existe.');
    }
    let newAssetUrl: string | undefined;
    let removedItems = 0;
    if (existing.view_type === 'TOP' && (metadata.variantCode !== undefined || metadata.slotCount !== undefined)) {
      throw new ApiError(422, 'INVALID_STATIC_SVG_METADATA', 'Un SVG superior no utiliza variante ni cantidad de slots.');
    }
    const sourceToValidate = rawSvg ?? (existing.view_type === 'FRONT' && metadata.slotCount !== undefined
      ? await this.storage.read(existing.asset_url)
      : undefined);
    if (sourceToValidate !== undefined) {
      const sanitized = sanitizeSvg(sourceToValidate);
      if (existing.view_type === 'TOP') {
        const locations = visibleLocations(await getLocations(this.pool, schemeId));
        validateTopSvg(sanitized, new Set(locations.map((row) => row.code)));
      } else {
        validateFrontSvg(sanitized, metadata.slotCount ?? existing.slot_count ?? 0);
      }
      if (rawSvg !== undefined) newAssetUrl = await this.storage.write(schemeId, sanitized.source);
      removedItems = sanitized.removedItems;
    }
    try {
      const updated = await withTransaction(this.pool, async (client) => {
        await assertMapEditable(client, schemeId);
        const result = await client.query<SvgRow>(
          `UPDATE map_layer_svgs
              SET name = COALESCE($2, name),
                  variant_code = CASE WHEN $3 THEN $4 ELSE variant_code END,
                  slot_count = CASE WHEN $5 THEN $6 ELSE slot_count END,
                  enabled = COALESCE($7, enabled),
                  asset_url = COALESCE($8, asset_url)
            WHERE map_layer_svg_id = $1
          RETURNING map_layer_svg_id, map_layer_id, name, variant_code,
                    asset_url, slot_count, enabled`,
          [
            svgId,
            metadata.name ?? null,
            Object.hasOwn(metadata, 'variantCode'),
            metadata.variantCode ?? null,
            Object.hasOwn(metadata, 'slotCount'),
            metadata.slotCount ?? null,
            metadata.enabled ?? null,
            newAssetUrl ?? null,
          ],
        );
        return result.rows[0] as SvgRow;
      });
      if (newAssetUrl !== undefined) await this.removeAssetsBestEffort([existing.asset_url]);
      return { ...updated, removedItems };
    } catch (error) {
      if (newAssetUrl !== undefined) await this.storage.remove(newAssetUrl);
      throw error;
    }
  }

  async setAssignment(
    schemeId: number,
    layerId: number,
    contextLocationId: number,
    mapLayerSvgId: number | null,
  ) {
    return withTransaction(this.pool, async (client) => {
      await assertMapEditable(client, schemeId);
      await requireLayer(client, schemeId, layerId, 'FRONT');
      if (mapLayerSvgId === null) {
        await client.query(
          'DELETE FROM map_layer_svg_assignments WHERE map_layer_id = $1 AND context_location_id = $2',
          [layerId, contextLocationId],
        );
        return { mapLayerId: layerId, contextLocationId, mapLayerSvgId: null };
      }
      await client.query(
        `INSERT INTO map_layer_svg_assignments
           (map_layer_id, map_layer_svg_id, context_location_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (map_layer_id, context_location_id)
         DO UPDATE SET map_layer_svg_id = EXCLUDED.map_layer_svg_id`,
        [layerId, mapLayerSvgId, contextLocationId],
      );
      return { mapLayerId: layerId, contextLocationId, mapLayerSvgId };
    });
  }

  async setDrilldown(
    schemeId: number,
    topLayerId: number,
    schemeLevelId: number,
    frontLayerId: number | null,
  ) {
    return withTransaction(this.pool, async (client) => {
      await assertMapEditable(client, schemeId);
      await requireLayer(client, schemeId, topLayerId, 'TOP');
      if (frontLayerId !== null) await requireLayer(client, schemeId, frontLayerId, 'FRONT');
      const result = await client.query(
        `UPDATE map_layer_scheme_levels
            SET drilldown_map_layer_id = $3
          WHERE map_layer_id = $1 AND scheme_level_id = $2`,
        [topLayerId, schemeLevelId, frontLayerId],
      );
      if (result.rowCount !== 1) {
        throw new ApiError(404, 'MAP_LEVEL_NOT_FOUND', 'La capa superior no representa ese nivel.');
      }
      return { topLayerId, schemeLevelId, frontLayerId };
    });
  }

  async deleteLayer(schemeId: number, layerId: number) {
    const assets = await this.pool.query<{ asset_url: string }>(
      `SELECT svg.asset_url FROM map_layer_svgs AS svg
        JOIN map_layers AS ml ON ml.map_layer_id = svg.map_layer_id
       WHERE ml.scheme_id = $1 AND ml.map_layer_id = $2`,
      [schemeId, layerId],
    );
    await withTransaction(this.pool, async (client) => {
      await assertMapEditable(client, schemeId);
      await requireLayer(client, schemeId, layerId);
      await client.query('DELETE FROM map_layer_svg_assignments WHERE map_layer_id = $1', [layerId]);
      await client.query('UPDATE map_layer_scheme_levels SET drilldown_map_layer_id = NULL WHERE drilldown_map_layer_id = $1', [layerId]);
      await client.query('DELETE FROM map_layer_svgs WHERE map_layer_id = $1', [layerId]);
      await client.query('DELETE FROM map_layer_scheme_levels WHERE map_layer_id = $1', [layerId]);
      await client.query('DELETE FROM map_layers WHERE map_layer_id = $1', [layerId]);
    });
    await this.removeAssetsBestEffort(assets.rows.map((row) => row.asset_url));
    return { mapLayerId: layerId, deleted: true };
  }

  async deleteSvg(schemeId: number, svgId: number) {
    const result = await this.pool.query<SvgRow>(
      `SELECT svg.map_layer_svg_id, svg.map_layer_id, svg.name, svg.variant_code,
              svg.asset_url, svg.slot_count, svg.enabled
         FROM map_layer_svgs AS svg JOIN map_layers AS ml ON ml.map_layer_id = svg.map_layer_id
        WHERE ml.scheme_id = $1 AND svg.map_layer_svg_id = $2`,
      [schemeId, svgId],
    );
    const svg = result.rows[0];
    if (svg === undefined) throw new ApiError(404, 'MAP_SVG_NOT_FOUND', 'El SVG no existe.');
    await withTransaction(this.pool, async (client) => {
      await assertMapEditable(client, schemeId);
      await client.query('DELETE FROM map_layer_svg_assignments WHERE map_layer_svg_id = $1', [svgId]);
      await client.query('DELETE FROM map_layer_svgs WHERE map_layer_svg_id = $1', [svgId]);
    });
    await this.removeAssetsBestEffort([svg.asset_url]);
    return { mapLayerSvgId: svgId, deleted: true };
  }

  async validateMaps(schemeId: number, database: Queryable = this.pool): Promise<MapReadiness> {
    await getScheme(database, schemeId);
    const snapshot = await getMapSnapshot(database, schemeId);
    const locations = await getLocations(database, schemeId);
    const levels = await getLevels(database, schemeId);
    const terminalLocations = locations.filter((row) => row.level_is_terminal && row.range_start_key !== null);
    const topLayers = snapshot.layers.filter((layer) => layer.enabled && layer.view_type === 'TOP');
    const topCodesByLayer = new Map<number, Set<string>>();
    for (const layer of topLayers) {
      const svg = snapshot.svgs.find((row) => row.map_layer_id === layer.map_layer_id && row.enabled);
      if (svg !== undefined) {
        topCodesByLayer.set(layer.map_layer_id, new Set(sanitizeSvg(await this.storage.read(svg.asset_url)).locationCodes));
      }
    }
    const covered = new Set<number>();
    for (const terminal of terminalLocations) {
      const route = pathForLocation(terminal.location_id, locations);
      if (topLayers.some((layer) => {
        const represented = new Set(snapshot.levels.filter((item) => item.map_layer_id === layer.map_layer_id).map((item) => item.scheme_level_id));
        const codes = topCodesByLayer.get(layer.map_layer_id) ?? new Set<string>();
        return route.some((location) => represented.has(location.scheme_level_id) && codes.has(location.code));
      })) covered.add(terminal.location_id);
    }
    const missingLocationCodes = terminalLocations.filter((row) => !covered.has(row.location_id)).map((row) => row.code);

    const frontLayers = snapshot.layers.filter((layer) => layer.enabled && layer.view_type === 'FRONT');
    let missingAssignmentCount = 0;
    let unlinkedLayerCount = 0;
    const levelById = new Map(levels.map((level) => [level.scheme_level_id, level]));
    for (const layer of frontLayers) {
      const represented = snapshot.levels.find((row) => row.map_layer_id === layer.map_layer_id)?.scheme_level_id;
      const parentLevelId = represented === undefined ? undefined : levelById.get(represented)?.parent_level_id;
      const variants = snapshot.svgs.filter((row) => row.map_layer_id === layer.map_layer_id && row.enabled);
      const contexts = parentLevelId === undefined ? [] : locations.filter((row) => row.scheme_level_id === parentLevelId);
      const assigned = new Set(snapshot.assignments.filter((row) => row.map_layer_id === layer.map_layer_id).map((row) => row.context_location_id));
      missingAssignmentCount += contexts.filter((row) => !assigned.has(row.location_id)).length;
      if (variants.length === 0) missingAssignmentCount += Math.max(1, contexts.length);
      const linked = snapshot.levels.some((row) => row.drilldown_map_layer_id === layer.map_layer_id
        && topLayers.some((top) => top.map_layer_id === row.map_layer_id));
      if (!linked) unlinkedLayerCount += 1;
    }

    const blockers: MapReadiness['blockers'] = [];
    if (topLayers.length === 0) blockers.push({ code: 'TOP_MAP_REQUIRED', message: 'Se requiere al menos un mapa superior habilitado.' });
    if (missingLocationCodes.length > 0) blockers.push({ code: 'TOP_COVERAGE_INCOMPLETE', message: 'Los mapas superiores no cubren todos los rangos.' });
    if (missingAssignmentCount > 0) blockers.push({ code: 'FRONT_ASSIGNMENTS_INCOMPLETE', message: 'Hay capas frontales con asignaciones incompletas.' });
    if (unlinkedLayerCount > 0) blockers.push({ code: 'FRONT_LAYER_NOT_LINKED', message: 'Hay capas frontales sin enlace desde un mapa superior.' });
    return {
      ready: blockers.length === 0,
      top: {
        layerCount: topLayers.length,
        coveredTerminalCount: covered.size,
        terminalCount: terminalLocations.length,
        missingLocationCodes,
      },
      front: { layerCount: frontLayers.length, missingAssignmentCount, unlinkedLayerCount },
      blockers,
    };
  }

  async review(schemeId: number) {
    const [scheme, locations, levels, maps] = await Promise.all([
      getScheme(this.pool, schemeId),
      getLocations(this.pool, schemeId),
      getLevels(this.pool, schemeId),
      this.validateMaps(schemeId),
    ]);
    const terminal = locations.filter((row) => row.level_is_terminal);
    const missingRanges = terminal.filter((row) => row.range_start_key === null).map((row) => row.code);
    const blockers = [...maps.blockers];
    if (scheme.status !== 'ASSIGNED' || missingRanges.length > 0) {
      blockers.unshift({ code: 'RANGES_INCOMPLETE', message: 'Todas las ubicaciones terminales necesitan un rango.' });
    }
    return {
      scheme: schemeDto(scheme),
      counts: {
        levels: levels.filter((row) => row.parent_level_id !== null).length,
        locations: visibleLocations(locations).length,
        terminalLocations: terminal.length,
        assignedRanges: terminal.length - missingRanges.length,
      },
      ranges: { complete: missingRanges.length === 0 && terminal.length > 0, missingLocationCodes: missingRanges },
      maps,
      publishable: blockers.length === 0,
      blockers,
    };
  }

  async publish(schemeId: number, actorId: number, activate: boolean) {
    return withTransaction(this.pool, async (client) => {
      const scheme = await getScheme(client, schemeId, true);
      if (scheme.status !== 'ASSIGNED' || !scheme.enabled) {
        throw new ApiError(422, 'SCHEME_NOT_PUBLISHABLE', 'El esquema todavía no se puede publicar.');
      }
      const maps = await this.validateMaps(schemeId, client);
      if (!maps.ready) {
        throw new ApiError(422, 'SCHEME_NOT_PUBLISHABLE', 'El esquema todavía no se puede publicar.', maps.blockers);
      }
      await client.query(
        `UPDATE schemes
            SET published_by = COALESCE(published_by, $2),
                published_at = COALESCE(published_at, now())
          WHERE scheme_id = $1`,
        [schemeId, actorId],
      );
      if (activate) await this.activateWith(client, schemeId);
      return schemeDto(await getScheme(client, schemeId));
    });
  }

  private async activateWith(client: PoolClient, schemeId: number): Promise<void> {
    const scheme = await getScheme(client, schemeId, true);
    if (scheme.published_at === null || scheme.status !== 'ASSIGNED' || !scheme.enabled) {
      throw new ApiError(422, 'SCHEME_NOT_ACTIVATABLE', 'Solo un esquema publicado y completo puede activarse.');
    }
    await client.query('UPDATE schemes SET is_active = false WHERE is_active AND scheme_id <> $1', [schemeId]);
    await client.query('UPDATE schemes SET is_active = true WHERE scheme_id = $1', [schemeId]);
  }

  async activate(schemeId: number) {
    return withTransaction(this.pool, async (client) => {
      await this.activateWith(client, schemeId);
      return schemeDto(await getScheme(client, schemeId));
    });
  }

  async searchVisuals(
    schemeId: number,
    matches: Array<{ locationId: number }>,
  ) {
    const [snapshot, locations] = await Promise.all([
      getMapSnapshot(this.pool, schemeId),
      getLocations(this.pool, schemeId),
    ]);
    const topViews: Array<{ mapLayerId: number; name: string; assetUrl: string; highlightLocationCodes: string[] }> = [];
    const frontGroups = new Map<string, {
      mapLayerId: number;
      mapLayerSvgId: number;
      contextLocationId: number;
      name: string;
      assetUrl: string;
      highlightSlots: Set<number>;
    }>();

    for (const layer of snapshot.layers.filter((item) => item.enabled && item.view_type === 'TOP')) {
      const svg = snapshot.svgs.find((item) => item.map_layer_id === layer.map_layer_id && item.enabled);
      if (svg === undefined) continue;
      const sanitized = sanitizeSvg(await this.storage.read(svg.asset_url));
      const codesInSvg = new Set(sanitized.locationCodes);
      const associations = snapshot.levels.filter((item) => item.map_layer_id === layer.map_layer_id);
      const represented = new Set(associations.map((item) => item.scheme_level_id));
      const highlighted = new Set<string>();
      for (const match of matches) {
        const route = pathForLocation(match.locationId, locations);
        for (const location of route) {
          if (represented.has(location.scheme_level_id) && codesInSvg.has(location.code)) highlighted.add(location.code);
        }
        for (const association of associations.filter((item) => item.drilldown_map_layer_id !== null)) {
          const topContext = route.find((item) => item.scheme_level_id === association.scheme_level_id);
          if (topContext === undefined || !codesInSvg.has(topContext.code)) continue;
          const frontLayerId = association.drilldown_map_layer_id as number;
          const frontLevelId = snapshot.levels.find((item) => item.map_layer_id === frontLayerId)?.scheme_level_id;
          if (frontLevelId === undefined) continue;
          const representedLocation = route.find((item) => item.scheme_level_id === frontLevelId);
          if (representedLocation?.parent_location_id === null || representedLocation === undefined) continue;
          const assignment = snapshot.assignments.find((item) => item.map_layer_id === frontLayerId
            && item.context_location_id === representedLocation.parent_location_id);
          const frontSvg = assignment === undefined ? undefined : snapshot.svgs.find((item) => item.map_layer_svg_id === assignment.map_layer_svg_id && item.enabled);
          if (assignment === undefined || frontSvg === undefined) continue;
          const key = `${frontLayerId}:${assignment.context_location_id}:${frontSvg.map_layer_svg_id}`;
          const group = frontGroups.get(key) ?? {
            mapLayerId: frontLayerId,
            mapLayerSvgId: frontSvg.map_layer_svg_id,
            contextLocationId: assignment.context_location_id,
            name: frontSvg.name,
            assetUrl: frontSvg.asset_url,
            highlightSlots: new Set<number>(),
          };
          group.highlightSlots.add(representedLocation.sort_order);
          frontGroups.set(key, group);
        }
      }
      topViews.push({ mapLayerId: layer.map_layer_id, name: layer.name, assetUrl: svg.asset_url, highlightLocationCodes: [...highlighted] });
    }
    return {
      topViews,
      frontViews: [...frontGroups.values()].map((group) => ({ ...group, highlightSlots: [...group.highlightSlots].sort((a, b) => a - b) })),
    };
  }

  async cloneScheme(
    sourceSchemeId: number,
    actorId: number,
    input: { name: string; scope: 'levels' | 'levels_and_locations' | 'all' },
  ) {
    const createdAssets: string[] = [];
    try {
      return await withTransaction(this.pool, async (client) => {
        const source = await getScheme(client, sourceSchemeId, true);
        const profile = await client.query<{ ordering_profile_id: number }>('SELECT ordering_profile_id FROM schemes WHERE scheme_id = $1', [sourceSchemeId]);
        const targetResult = await client.query<{ scheme_id: number }>(
          `INSERT INTO schemes (name, short_description, ordering_profile_id, created_by)
           VALUES ($1, $2, $3, $4) RETURNING scheme_id`,
          [input.name, source.short_description, (profile.rows[0] as { ordering_profile_id: number }).ordering_profile_id, actorId],
        );
        const targetSchemeId = (targetResult.rows[0] as { scheme_id: number }).scheme_id;
        const sourceLevels = await client.query<LevelRow & { depth: number }>(
          `WITH RECURSIVE tree AS (
             SELECT sl.*, 0 AS depth FROM scheme_levels AS sl
              WHERE sl.scheme_id = $1 AND sl.parent_level_id IS NULL
             UNION ALL
             SELECT child.*, parent.depth + 1 FROM scheme_levels AS child
              JOIN tree AS parent ON child.parent_level_id = parent.scheme_level_id
              WHERE child.scheme_id = $1
           )
           SELECT scheme_level_id, parent_level_id, name, sort_order, is_search_terminal, depth
             FROM tree ORDER BY depth, sort_order, scheme_level_id`,
          [sourceSchemeId],
        );
        const levelMap = new Map<number, number>();
        for (const level of sourceLevels.rows) {
          const inserted = await client.query<{ scheme_level_id: number }>(
            `INSERT INTO scheme_levels (scheme_id, parent_level_id, name, sort_order, is_search_terminal)
             VALUES ($1, $2, $3, $4, $5) RETURNING scheme_level_id`,
            [targetSchemeId, level.parent_level_id === null ? null : levelMap.get(level.parent_level_id), level.name, level.sort_order, level.is_search_terminal],
          );
          levelMap.set(level.scheme_level_id, (inserted.rows[0] as { scheme_level_id: number }).scheme_level_id);
        }

        if (input.scope === 'levels' || source.status === 'DRAFT') {
          return schemeDto(await getScheme(client, targetSchemeId));
        }

        await client.query(`UPDATE schemes SET status = 'LEVELS_DEFINED' WHERE scheme_id = $1`, [targetSchemeId]);
        const sourceLocations = await client.query<LocationRow & { depth: number }>(
          `WITH RECURSIVE tree AS (
             SELECT l.*, 0 AS depth FROM locations AS l
              WHERE l.scheme_id = $1 AND l.parent_location_id IS NULL
             UNION ALL
             SELECT child.*, parent.depth + 1 FROM locations AS child
              JOIN tree AS parent ON child.parent_location_id = parent.location_id
              WHERE child.scheme_id = $1
           )
           SELECT tree.*, sl.name AS level_name, sl.is_search_terminal AS level_is_terminal
             FROM tree JOIN scheme_levels AS sl ON sl.scheme_level_id = tree.scheme_level_id
            ORDER BY depth, sort_order, location_id`,
          [sourceSchemeId],
        );
        const locationMap = new Map<number, number>();
        const codeMap = new Map<string, string>();
        for (const location of sourceLocations.rows) {
          const targetCode = `${targetSchemeId}${location.code.slice(String(sourceSchemeId).length)}`;
          const inserted = await client.query<{ location_id: number }>(
            `INSERT INTO locations
               (scheme_id, parent_location_id, scheme_level_id, name, code, sort_order, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING location_id`,
            [
              targetSchemeId,
              location.parent_location_id === null ? null : locationMap.get(location.parent_location_id),
              levelMap.get(location.scheme_level_id),
              location.name,
              targetCode,
              location.sort_order,
              actorId,
            ],
          );
          locationMap.set(location.location_id, (inserted.rows[0] as { location_id: number }).location_id);
          codeMap.set(location.code, targetCode);
        }

        if (input.scope === 'levels_and_locations' || ['DRAFT', 'LEVELS_DEFINED'].includes(source.status)) {
          return schemeDto(await getScheme(client, targetSchemeId));
        }

        await client.query(`UPDATE schemes SET status = 'LOCATIONS_DEFINED' WHERE scheme_id = $1`, [targetSchemeId]);
        const ranged = sourceLocations.rows.filter((row) => row.range_start_key !== null);
        if (ranged.length > 0) {
          await client.query(`UPDATE schemes SET status = 'PARTIALLY_ASSIGNED' WHERE scheme_id = $1`, [targetSchemeId]);
          for (const location of ranged) {
            await client.query(
              `UPDATE locations SET range_start_raw = $2, range_end_raw = $3,
                 range_start_normalized = $4, range_end_normalized = $5,
                 range_start_key = $6, range_end_key = $7, updated_by = $8
               WHERE location_id = $1`,
              [
                locationMap.get(location.location_id),
                location.range_start_raw,
                location.range_end_raw,
                location.range_start_normalized,
                location.range_end_normalized,
                location.range_start_key,
                location.range_end_key,
                actorId,
              ],
            );
          }
          if (source.status === 'ASSIGNED') {
            await client.query(`UPDATE schemes SET status = 'ASSIGNED' WHERE scheme_id = $1`, [targetSchemeId]);
          }
        }

        const sourceMaps = await getMapSnapshot(client, sourceSchemeId);
        const layerMap = new Map<number, number>();
        for (const layer of sourceMaps.layers) {
          const inserted = await client.query<{ map_layer_id: number }>(
            `INSERT INTO map_layers (scheme_id, name, view_type, render_mode, enabled)
             VALUES ($1, $2, $3, $4, $5) RETURNING map_layer_id`,
            [targetSchemeId, layer.name, layer.view_type, layer.render_mode, layer.enabled],
          );
          layerMap.set(layer.map_layer_id, (inserted.rows[0] as { map_layer_id: number }).map_layer_id);
        }
        for (const association of sourceMaps.levels) {
          await client.query(
            'INSERT INTO map_layer_scheme_levels (map_layer_id, scheme_level_id) VALUES ($1, $2)',
            [layerMap.get(association.map_layer_id), levelMap.get(association.scheme_level_id)],
          );
        }
        for (const association of sourceMaps.levels.filter((row) => row.drilldown_map_layer_id !== null)) {
          await client.query(
            `UPDATE map_layer_scheme_levels SET drilldown_map_layer_id = $3
              WHERE map_layer_id = $1 AND scheme_level_id = $2`,
            [layerMap.get(association.map_layer_id), levelMap.get(association.scheme_level_id), layerMap.get(association.drilldown_map_layer_id as number)],
          );
        }
        const svgMap = new Map<number, number>();
        for (const svg of sourceMaps.svgs) {
          const sourceLayer = sourceMaps.layers.find((layer) => layer.map_layer_id === svg.map_layer_id);
          const assetUrl = await this.storage.clone(
            svg.asset_url,
            targetSchemeId,
            sourceLayer?.view_type === 'TOP' ? codeMap : undefined,
          );
          createdAssets.push(assetUrl);
          const inserted = await client.query<{ map_layer_svg_id: number }>(
            `INSERT INTO map_layer_svgs
               (map_layer_id, name, variant_code, asset_url, slot_count, enabled)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING map_layer_svg_id`,
            [layerMap.get(svg.map_layer_id), svg.name, svg.variant_code, assetUrl, svg.slot_count, svg.enabled],
          );
          svgMap.set(svg.map_layer_svg_id, (inserted.rows[0] as { map_layer_svg_id: number }).map_layer_svg_id);
        }
        for (const assignment of sourceMaps.assignments) {
          await client.query(
            `INSERT INTO map_layer_svg_assignments
               (map_layer_id, map_layer_svg_id, context_location_id)
             VALUES ($1, $2, $3)`,
            [layerMap.get(assignment.map_layer_id), svgMap.get(assignment.map_layer_svg_id), locationMap.get(assignment.context_location_id)],
          );
        }
        return schemeDto(await getScheme(client, targetSchemeId));
      });
    } catch (error) {
      await Promise.all(createdAssets.map((asset) => this.storage.remove(asset)));
      throw error;
    }
  }
}
