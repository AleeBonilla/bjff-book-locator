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

describe('recálculo y concurrencia de distribuciones', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('reemplaza por completo un DONE y rechaza una revisión obsoleta', async () => {
    const fixture = await createDoneRun(app);
    await testDb
      .updateTable('location_distribution_settings')
      .set({ capacity_value: 1 })
      .where('scheme_id', '=', fixture.schemeId)
      .execute();
    const recalculated = await request(app.getHttpServer())
      .post(`/api/distribution-runs/${fixture.runId}/recalculate`)
      .set('Cookie', fixture.cookie)
      .send(recalculateCommand(1, { value: 1, unit: 'BOOKS' }))
      .expect(200);

    expect(recalculated.body).toMatchObject({
      distributionRunId: fixture.runId,
      status: 'DONE',
      revision: 2,
      counters: { unassignedCount: 1 },
    });
    await request(app.getHttpServer())
      .post(`/api/distribution-runs/${fixture.runId}/recalculate`)
      .set('Cookie', fixture.cookie)
      .send(recalculateCommand(1, { value: 3, unit: 'BOOKS' }))
      .expect(409)
      .expect(({ body }) => {
        expect(body.error).toMatchObject({
          code: 'RUN_VERSION_CONFLICT',
          details: { currentRevision: 2 },
        });
      });
  });

  it('revierte entradas y resultados nuevos si falla un recálculo DONE', async () => {
    const fixture = await createDoneRun(app);
    const before = await request(app.getHttpServer())
      .get(`/api/distribution-runs/${fixture.runId}`)
      .set('Cookie', fixture.cookie)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/distribution-runs/${fixture.runId}/recalculate`)
      .set('Cookie', fixture.cookie)
      .send({
        ...recalculateCommand(1, { value: 2, unit: 'BOOKS' }),
        anchors: [{ locationId: fixture.positionIds[0], boundaryCode: '150' }],
      })
      .expect(422);

    const after = await request(app.getHttpServer())
      .get(`/api/distribution-runs/${fixture.runId}`)
      .set('Cookie', fixture.cookie)
      .expect(200);
    expect(after.body).toEqual(before.body);
  });

  it('reintenta un ERROR con la misma identidad e incrementa la revisión', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const structure = await seedDistributionStructure(adminId, 2);
    const load = await seedDoneLoad(adminId);
    const failed = await request(app.getHttpServer())
      .post('/api/distribution-runs')
      .set('Cookie', cookie)
      .send({
        schemeId: structure.schemeId,
        collectionLoadId: load.loadId,
        strategy: 'ANCHORED',
        defaults: defaultSettings({ value: 3, unit: 'BOOKS' }),
        anchors: [],
        manualRanges: [],
      })
      .expect(422);
    const runId = failed.body.error.details.runId as number;

    const retried = await request(app.getHttpServer())
      .post(`/api/distribution-runs/${runId}/recalculate`)
      .set('Cookie', cookie)
      .send({
        ...recalculateCommand(1, { value: 3, unit: 'BOOKS' }),
        anchors: [{ locationId: structure.positionIds[1], boundaryCode: '200' }],
      })
      .expect(200);
    expect(retried.body).toMatchObject({
      distributionRunId: runId,
      status: 'DONE',
      revision: 2,
    });
  });

  it('conserva ERROR, incrementa revisión y no deja parciales si el reintento falla', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const structure = await seedDistributionStructure(adminId, 2);
    const load = await seedDoneLoad(adminId);
    const failed = await request(app.getHttpServer())
      .post('/api/distribution-runs')
      .set('Cookie', cookie)
      .send({
        schemeId: structure.schemeId,
        collectionLoadId: load.loadId,
        strategy: 'ANCHORED',
        defaults: defaultSettings({ value: 3, unit: 'BOOKS' }),
        anchors: [],
        manualRanges: [],
      })
      .expect(422);
    const runId = failed.body.error.details.runId as number;

    const retry = await request(app.getHttpServer())
      .post(`/api/distribution-runs/${runId}/recalculate`)
      .set('Cookie', cookie)
      .send(recalculateCommand(1, { value: 3, unit: 'BOOKS' }))
      .expect(422);
    expect(retry.body.error.details).toMatchObject({ revision: 2 });

    const row = await testDb
      .selectFrom('distribution_runs')
      .select(['status', 'revision'])
      .where('distribution_run_id', '=', runId)
      .executeTakeFirstOrThrow();
    const [positions, ranges, placements] = await Promise.all([
      testDb
        .selectFrom('distribution_position_inputs')
        .selectAll()
        .where('distribution_run_id', '=', runId)
        .execute(),
      testDb
        .selectFrom('distribution_ranges')
        .selectAll()
        .where('distribution_run_id', '=', runId)
        .execute(),
      testDb
        .selectFrom('book_placements')
        .selectAll()
        .where('distribution_run_id', '=', runId)
        .execute(),
    ]);
    expect(row).toEqual({ status: 'ERROR', revision: 2 });
    expect([positions, ranges, placements].every((rows) => rows.length === 0)).toBe(true);
  });

  it('responde RUN_BUSY cuando otra mutación conserva el lock', async () => {
    const fixture = await createDoneRun(app);
    let release!: () => void;
    let locked!: () => void;
    const releasePromise = new Promise<void>((resolve) => (release = resolve));
    const lockedPromise = new Promise<void>((resolve) => (locked = resolve));
    const transaction = testDb.transaction().execute(async (tx) => {
      await tx
        .selectFrom('distribution_runs')
        .select('distribution_run_id')
        .where('distribution_run_id', '=', fixture.runId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      locked();
      await releasePromise;
    });
    await lockedPromise;
    try {
      await request(app.getHttpServer())
        .post(`/api/distribution-runs/${fixture.runId}/recalculate`)
        .set('Cookie', fixture.cookie)
        .send(recalculateCommand(1, { value: 2, unit: 'BOOKS' }))
        .expect(409)
        .expect(({ body }) => expect(body.error.code).toBe('RUN_BUSY'));
    } finally {
      release();
      await transaction;
    }
  });
});

async function createDoneRun(app: INestApplication) {
  const adminId = await seedAdmin();
  const cookie = await login(app);
  const structure = await seedDistributionStructure(adminId, 2);
  const load = await seedDoneLoad(adminId);
  const created = await request(app.getHttpServer())
    .post('/api/distribution-runs')
    .set('Cookie', cookie)
    .send({
      schemeId: structure.schemeId,
      collectionLoadId: load.loadId,
      strategy: 'HYBRID',
      defaults: defaultSettings({ value: 2, unit: 'BOOKS' }),
      anchors: [],
      manualRanges: [],
    })
    .expect(201);
  return { cookie, runId: created.body.distributionRunId as number, ...structure };
}

function recalculateCommand(
  expectedRevision: number,
  capacity: { value: number; unit: 'BOOKS' },
) {
  return {
    expectedRevision,
    rebuildSnapshot: true,
    defaults: defaultSettings(capacity),
    anchors: [],
    manualRanges: [],
  };
}

function defaultSettings(capacity: { value: number; unit: 'BOOKS' }) {
  return { capacity, targetFillRatio: 1, allowOverflow: false };
}
