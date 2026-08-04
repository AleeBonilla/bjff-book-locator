import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { testDb } from '../setup.js';
import {
  createApp,
  login,
  seedAdmin,
  seedDistributionStructure,
  seedDoneLoad,
} from '../helpers.js';

describe('contratos HTTP de estrategias', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('rechaza entradas prohibidas y localiza el anchor corregible', async () => {
    const fixture = await setup(app, 2);
    const response = await create(app, fixture.cookie, {
      ...baseCommand(fixture, 'CAPACITY'),
      anchors: [{ locationId: fixture.positionIds[1], boundaryCode: '200' }],
    }).expect(422);
    expect(response.body.error.code).toBe('INVALID_STRATEGY_INPUTS');

    const invalid = await create(app, fixture.cookie, {
      ...baseCommand(fixture, 'HYBRID'),
      anchors: [{ locationId: 999999, boundaryCode: '200' }],
    }).expect(422);
    expect(invalid.body.error).toMatchObject({
      code: 'INVALID_ANCHORS',
      details: { locationId: 999999 },
    });
  });

  it('normaliza anchors legibles y conserva el origen ANCHORED', async () => {
    const fixture = await setup(app, 2);
    const response = await create(app, fixture.cookie, {
      ...baseCommand(fixture, 'ANCHORED'),
      anchors: [{ locationId: fixture.positionIds[1], boundaryCode: ' 200 ' }],
    }).expect(201);
    expect(response.body.anchors).toEqual([
      expect.objectContaining({
        locationId: fixture.positionIds[1],
        boundaryCode: '200',
      }),
    ]);
    expect(
      response.body.ranges.some(
        (range: { source: string }) => range.source === 'ANCHORED',
      ),
    ).toBe(true);
  });

  it('acepta WEIGHTED solo con una unidad relativa común', async () => {
    const fixture = await setup(app, 2);
    await testDb
      .updateTable('location_distribution_settings')
      .set({ capacity_unit: 'WEIGHT', capacity_value: 1 })
      .where('location_id', '=', fixture.positionIds[0]!)
      .execute();
    await testDb
      .updateTable('location_distribution_settings')
      .set({ capacity_unit: 'WEIGHT', capacity_value: 3 })
      .where('location_id', '=', fixture.positionIds[1]!)
      .execute();
    const response = await create(app, fixture.cookie, {
      ...baseCommand(fixture, 'WEIGHTED'),
      defaults: {
        capacity: { value: 1, unit: 'WEIGHT' },
        targetFillRatio: 1,
        allowOverflow: false,
      },
    }).expect(201);
    expect(response.body).toMatchObject({ status: 'DONE', strategy: 'WEIGHTED' });
  });

  it('normaliza una cobertura MANUAL completa y persiste su fuente', async () => {
    const fixture = await setup(app, 2);
    const response = await create(app, fixture.cookie, {
      ...baseCommand(fixture, 'MANUAL'),
      manualRanges: [
        { locationId: fixture.positionIds[0], startCode: null, endCode: ' 200 ' },
        { locationId: fixture.positionIds[1], startCode: '200', endCode: null },
      ],
    }).expect(201);
    expect(response.body.ranges).toEqual([
      expect.objectContaining({ startCode: null, endCode: '200', source: 'MANUAL' }),
      expect.objectContaining({ startCode: '200', endCode: null, source: 'MANUAL' }),
    ]);
  });
});

async function setup(app: INestApplication, positionCount: number) {
  const adminId = await seedAdmin();
  const cookie = await login(app);
  const structure = await seedDistributionStructure(adminId, positionCount);
  const load = await seedDoneLoad(adminId);
  return { cookie, loadId: load.loadId, ...structure };
}

function baseCommand(
  fixture: { schemeId: number; loadId: number },
  strategy: 'CAPACITY' | 'WEIGHTED' | 'ANCHORED' | 'HYBRID' | 'MANUAL',
) {
  return {
    schemeId: fixture.schemeId,
    collectionLoadId: fixture.loadId,
    strategy,
    defaults: {
      capacity: { value: 10, unit: 'BOOKS' },
      targetFillRatio: 1,
      allowOverflow: false,
    },
    anchors: [],
    manualRanges: [],
  };
}

function create(app: INestApplication, cookie: string, body: Record<string, unknown>) {
  return request(app.getHttpServer())
    .post('/api/distribution-runs')
    .set('Cookie', cookie)
    .send(body);
}
