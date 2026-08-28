import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import request, { type SuperTest, type Test } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { SvgStorage } from '../maps/storage.js';

const migrationsDirectory = fileURLToPath(new URL('../../../../database/', import.meta.url));

describe('API administrativa con PostgreSQL', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let storageDirectory: string;
  let api: SuperTest<Test>;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('bjff_test')
      .withUsername('bjff')
      .withPassword('test-password')
      .start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    for (const migration of [
      '001_initial_schema.sql',
      '002_seed_basic_ordering_profile.sql',
      '003_seed_system_actor.sql',
    ]) {
      await pool.query(await readFile(join(migrationsDirectory, migration), 'utf8'));
    }
    storageDirectory = await mkdtemp(join(tmpdir(), 'bjff-api-maps-'));
    const storage = new SvgStorage(storageDirectory);
    await storage.ensureReady();
    api = request(createApp({ pool, storage }));
  }, 120_000);

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
    if (storageDirectory !== undefined) await rm(storageDirectory, { recursive: true, force: true });
  }, 60_000);

  it('completa el flujo, encuentra solapamientos y protege lo publicado', async () => {
    const created = await api.post('/api/admin/schemes').send({ name: 'Biblioteca de prueba' }).expect(201);
    const schemeId = created.body.data.schemeId as number;

    const levelsResponse = await api.put(`/api/admin/schemes/${schemeId}/levels`).send({
      levels: [
        { key: 'floor', parentKey: null, name: 'Piso', sortOrder: 1, isSearchTerminal: false },
        { key: 'shelf', parentKey: 'floor', name: 'Anaquel', sortOrder: 1, isSearchTerminal: true },
      ],
    }).expect(200);
    const floorLevelId = levelsResponse.body.data[0].schemeLevelId as number;
    const shelfLevelId = levelsResponse.body.data[1].schemeLevelId as number;

    await api.post(`/api/admin/schemes/${schemeId}/levels/confirm`).expect(200);
    const floors = await api.post(`/api/admin/schemes/${schemeId}/locations`).send({
      parentLocationId: null,
      quantity: 1,
    }).expect(201);
    const floor = floors.body.data[0] as { locationId: number; code: string };
    const shelves = await api.post(`/api/admin/schemes/${schemeId}/locations`).send({
      parentLocationId: floor.locationId,
      quantity: 2,
    }).expect(201);
    const firstShelf = shelves.body.data[0] as { locationId: number };
    const secondShelf = shelves.body.data[1] as { locationId: number };
    await api.post(`/api/admin/schemes/${schemeId}/locations/confirm`).expect(200);

    await api.put(`/api/admin/schemes/${schemeId}/ranges`).send({
      items: [
        { locationId: firstShelf.locationId, rangeStart: '300.1', rangeEnd: '300.19' },
        { locationId: secondShelf.locationId, rangeStart: '300.15', rangeEnd: '300.3' },
      ],
    }).expect(200);

    const textualSearch = await api.post(`/api/admin/schemes/${schemeId}/search-tests`)
      .send({ callNumber: '300.16' })
      .expect(200);
    expect(textualSearch.body.data.matches).toHaveLength(2);
    expect(textualSearch.body.data.maps.topViews).toEqual([]);

    const svg = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <script>alert(1)</script>
        <rect data-location-code="${floor.code}" onclick="alert(1)" />
      </svg>
    `);
    const topMap = await api.post(`/api/admin/schemes/${schemeId}/maps/top`)
      .field('metadata', JSON.stringify({
        name: 'Vista superior',
        svgName: 'Piso principal',
        representedLevelIds: [floorLevelId],
      }))
      .attach('svg', svg, { filename: 'top.svg', contentType: 'image/svg+xml' })
      .expect(201);
    expect(topMap.body.data.removedItems).toBeGreaterThan(0);

    const frontLayer = await api.post(`/api/admin/schemes/${schemeId}/maps/front`).send({
      name: 'Vista de anaqueles',
      representedLevelId: shelfLevelId,
    }).expect(201);
    const frontSvg = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <rect data-slot="1"/><rect data-slot="2"/>
      </svg>
    `);
    const variant = await api
      .post(`/api/admin/schemes/${schemeId}/maps/front/${frontLayer.body.data.mapLayerId}/variants`)
      .field('metadata', JSON.stringify({ name: 'Dos anaqueles', variantCode: 'shelves-2', slotCount: 2 }))
      .attach('svg', frontSvg, { filename: 'front.svg', contentType: 'image/svg+xml' })
      .expect(201);
    await api
      .put(`/api/admin/schemes/${schemeId}/maps/layers/${frontLayer.body.data.mapLayerId}/assignments/${floor.locationId}`)
      .send({ mapLayerSvgId: variant.body.data.mapLayerSvgId })
      .expect(200);
    await api
      .put(`/api/admin/schemes/${schemeId}/maps/layers/${topMap.body.data.mapLayerId}/drilldowns/${floorLevelId}`)
      .send({ frontLayerId: frontLayer.body.data.mapLayerId })
      .expect(200);

    const disabledLayer = await api
      .patch(`/api/admin/schemes/${schemeId}/maps/layers/${frontLayer.body.data.mapLayerId}`)
      .send({ enabled: false })
      .expect(200);
    expect(disabledLayer.body.data.enabled).toBe(false);
    await api
      .patch(`/api/admin/schemes/${schemeId}/maps/layers/${frontLayer.body.data.mapLayerId}`)
      .send({ enabled: true })
      .expect(200);

    const originalAssetUrl = topMap.body.data.assetUrl as string;
    const replacement = await api
      .put(`/api/admin/schemes/${schemeId}/maps/svgs/${topMap.body.data.mapLayerSvgId}`)
      .field('metadata', JSON.stringify({ name: 'Piso principal actualizado' }))
      .attach('svg', Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><rect data-location-code="${floor.code}"/></svg>`), {
        filename: 'top-replacement.svg',
        contentType: 'image/svg+xml',
      })
      .expect(200);
    expect(replacement.body.data.asset_url).not.toBe(originalAssetUrl);
    await expect(access(join(storageDirectory, originalAssetUrl.replace('/api/assets/maps/', '')))).rejects.toThrow();

    const removableVariant = await api
      .post(`/api/admin/schemes/${schemeId}/maps/front/${frontLayer.body.data.mapLayerId}/variants`)
      .field('metadata', JSON.stringify({ name: 'Dos anaqueles alternativa', variantCode: 'shelves-2-alt', slotCount: 2 }))
      .attach('svg', frontSvg, { filename: 'front-alternative.svg', contentType: 'image/svg+xml' })
      .expect(201);
    await api
      .delete(`/api/admin/schemes/${schemeId}/maps/svgs/${removableVariant.body.data.mapLayerSvgId}`)
      .expect(200);

    const visualSearch = await api.post(`/api/admin/schemes/${schemeId}/search-tests`)
      .send({ callNumber: '300.16' })
      .expect(200);
    expect(visualSearch.body.data.maps.topViews[0].highlightLocationCodes).toEqual([floor.code]);
    expect(visualSearch.body.data.maps.frontViews[0].highlightSlots).toEqual([1, 2]);

    const review = await api.get(`/api/admin/schemes/${schemeId}/review`).expect(200);
    expect(review.body.data.publishable).toBe(true);

    const published = await api.post(`/api/admin/schemes/${schemeId}/publish`)
      .send({ activate: true })
      .expect(200);
    expect(published.body.data.isActive).toBe(true);
    expect(published.body.data.isPublished).toBe(true);

    await api.patch(`/api/admin/schemes/${schemeId}`).send({ name: 'No permitido' }).expect(409);

    const levelClone = await api.post(`/api/admin/schemes/${schemeId}/clone`).send({
      name: 'Copia de niveles',
      scope: 'levels',
    }).expect(201);
    expect(levelClone.body.data.status).toBe('DRAFT');
    const levelCloneLocations = await api.get(`/api/admin/schemes/${levelClone.body.data.schemeId}/locations`).expect(200);
    expect(levelCloneLocations.body.data).toEqual([]);

    const locationClone = await api.post(`/api/admin/schemes/${schemeId}/clone`).send({
      name: 'Copia de ubicaciones',
      scope: 'levels_and_locations',
    }).expect(201);
    expect(locationClone.body.data.status).toBe('LEVELS_DEFINED');
    const locationCloneMaps = await api.get(`/api/admin/schemes/${locationClone.body.data.schemeId}/maps`).expect(200);
    expect(locationCloneMaps.body.data).toEqual([]);

    const clone = await api.post(`/api/admin/schemes/${schemeId}/clone`).send({
      name: 'Copia completa',
      scope: 'all',
    }).expect(201);
    expect(clone.body.data.status).toBe('ASSIGNED');
    expect(clone.body.data.isActive).toBe(false);
    expect(clone.body.data.isPublished).toBe(false);

    const cloneMaps = await api.get(`/api/admin/schemes/${clone.body.data.schemeId}/maps`).expect(200);
    expect(cloneMaps.body.data).toHaveLength(2);
    expect(cloneMaps.body.data[0].svgs[0].assetUrl).not.toBe(topMap.body.data.assetUrl);

    await api.delete(`/api/admin/schemes/${schemeId}`).send({}).expect(400);
    const deleted = await api.delete(`/api/admin/schemes/${schemeId}`)
      .send({ confirmDataLoss: true });
    expect(deleted.status, deleted.body.error?.message).toBe(200);
    expect(deleted.body.data).toMatchObject({
      schemeId,
      deleted: true,
      wasActive: true,
      wasPublished: true,
    });
    await api.get(`/api/admin/schemes/${schemeId}`).expect(404);
    await expect(access(join(
      storageDirectory,
      String(replacement.body.data.asset_url).replace('/api/assets/maps/', ''),
    ))).rejects.toThrow();
  }, 60_000);

  it('admite ramas con cantidades distintas y revierte la configuración dependiente', async () => {
    const created = await api.post('/api/admin/schemes').send({ name: 'Estructura variable' }).expect(201);
    const schemeId = created.body.data.schemeId as number;
    await api.put(`/api/admin/schemes/${schemeId}/levels`).send({
      levels: [
        { key: 'floor', parentKey: null, name: 'Piso', sortOrder: 1, isSearchTerminal: false },
        { key: 'cabinet', parentKey: 'floor', name: 'Mueble', sortOrder: 1, isSearchTerminal: false },
        { key: 'shelf', parentKey: 'cabinet', name: 'Anaquel', sortOrder: 1, isSearchTerminal: true },
      ],
    }).expect(200);
    await api.post(`/api/admin/schemes/${schemeId}/levels/confirm`).expect(200);

    const floors = await api.post(`/api/admin/schemes/${schemeId}/locations`).send({
      parentLocationId: null,
      quantity: 2,
    }).expect(201);
    const cabinets: number[] = [];
    for (const floor of floors.body.data as Array<{ locationId: number }>) {
      const createdCabinet = await api.post(`/api/admin/schemes/${schemeId}/locations`).send({
        parentLocationId: floor.locationId,
        quantity: 1,
      }).expect(201);
      cabinets.push(createdCabinet.body.data[0].locationId as number);
    }
    const firstShelves = await api.post(`/api/admin/schemes/${schemeId}/locations`).send({
      parentLocationId: cabinets[0],
      quantity: 1,
    }).expect(201);
    await api.post(`/api/admin/schemes/${schemeId}/locations`).send({
      parentLocationId: cabinets[1],
      quantity: 3,
    }).expect(201);
    await api.post(`/api/admin/schemes/${schemeId}/locations/confirm`).expect(200);

    await api.put(`/api/admin/schemes/${schemeId}/ranges/${firstShelves.body.data[0].locationId}`)
      .send({ rangeStart: '400.1', rangeEnd: '400.2' })
      .expect(200);
    const partial = await api.get(`/api/admin/schemes/${schemeId}`).expect(200);
    expect(partial.body.data.status).toBe('PARTIALLY_ASSIGNED');

    const reopenedLocations = await api.post(`/api/admin/schemes/${schemeId}/actions/reopen-locations`)
      .send({ confirmDataLoss: true })
      .expect(200);
    expect(reopenedLocations.body.data.status).toBe('LEVELS_DEFINED');
    const ranges = await api.get(`/api/admin/schemes/${schemeId}/ranges`).expect(200);
    expect(ranges.body.data.every((location: { range: unknown }) => location.range === null)).toBe(true);

    const reopenedLevels = await api.post(`/api/admin/schemes/${schemeId}/actions/reopen-levels`)
      .send({ confirmDataLoss: true })
      .expect(200);
    expect(reopenedLevels.body.data.status).toBe('DRAFT');
    const locations = await api.get(`/api/admin/schemes/${schemeId}/locations`).expect(200);
    expect(locations.body.data).toEqual([]);

    const deletedDraft = await api.delete(`/api/admin/schemes/${schemeId}`)
      .send({ confirmDataLoss: true })
      .expect(200);
    expect(deletedDraft.body.data).toMatchObject({ wasActive: false, wasPublished: false });
  }, 60_000);
});
