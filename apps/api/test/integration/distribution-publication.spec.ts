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
  seedPublishedDistribution,
} from '../helpers.js';

describe('publicación de distribuciones', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('reemplaza la versión del scheme y activa todo en una transacción', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const existing = await seedPublishedDistribution(adminId);
    const created = await request(app.getHttpServer())
      .post('/api/distribution-runs')
      .set('Cookie', cookie)
      .send({
        schemeId: existing.schemeId,
        collectionLoadId: existing.loadId,
        strategy: 'HYBRID',
        defaults: {
          capacity: { value: 10, unit: 'BOOKS' },
          targetFillRatio: 1,
          allowOverflow: false,
        },
        anchors: [],
        manualRanges: [],
      })
      .expect(201);

    const published = await request(app.getHttpServer())
      .post(`/api/distribution-runs/${created.body.distributionRunId}/publish`)
      .set('Cookie', cookie)
      .send({
        expectedRevision: created.body.revision,
        previewAccepted: true,
        unassignedAccepted: false,
      })
      .expect(200);
    expect(published.body).toMatchObject({ isPublished: true, revision: 2 });

    const rows = await testDb
      .selectFrom('distribution_runs')
      .select(['distribution_run_id', 'is_published', 'revision'])
      .where('scheme_id', '=', existing.schemeId)
      .orderBy('distribution_run_id')
      .execute();
    expect(rows.filter((row) => row.is_published)).toHaveLength(1);
    expect(rows.find((row) => row.distribution_run_id === existing.runId)).toMatchObject({
      is_published: false,
      revision: 2,
    });
  });

  it('exige una confirmación adicional cuando hay registros sin asignar', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const structure = await seedDistributionStructure(adminId, 1);
    const load = await seedDoneLoad(adminId, ['100', null]);
    const created = await request(app.getHttpServer())
      .post('/api/distribution-runs')
      .set('Cookie', cookie)
      .send({
        schemeId: structure.schemeId,
        collectionLoadId: load.loadId,
        strategy: 'HYBRID',
        defaults: {
          capacity: { value: 10, unit: 'BOOKS' },
          targetFillRatio: 1,
          allowOverflow: false,
        },
        anchors: [],
        manualRanges: [],
      })
      .expect(201);
    expect(created.body.warnings.unassignedCount).toBe(1);

    const rejected = await request(app.getHttpServer())
      .post(`/api/distribution-runs/${created.body.distributionRunId}/publish`)
      .set('Cookie', cookie)
      .send({ expectedRevision: 1, previewAccepted: true })
      .expect(409);
    expect(rejected.body.error).toMatchObject({
      code: 'UNASSIGNED_CONFIRMATION_REQUIRED',
      details: { unassignedCount: 1 },
    });

    await request(app.getHttpServer())
      .post(`/api/distribution-runs/${created.body.distributionRunId}/publish`)
      .set('Cookie', cookie)
      .send({
        expectedRevision: 1,
        previewAccepted: true,
        unassignedAccepted: true,
      })
      .expect(200);
  });
});
