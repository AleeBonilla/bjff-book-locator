import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createApp,
  login,
  seedAdmin,
  seedDistributionStructure,
  seedDoneLoad,
  seedPublishedDistribution,
} from '../helpers.js';

describe('derivación, comparación y restauración', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('deriva con otra carga, compara y restaura sin mutar resultados', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const base = await seedPublishedDistribution(adminId);

    const templateResponse = await request(app.getHttpServer())
      .get(`/api/distribution-runs/${base.runId}/derivation-template`)
      .set('Cookie', cookie)
      .expect(200);
    expect(templateResponse.body).toEqual({
      basedOnDistributionRunId: base.runId,
      schemeId: base.schemeId,
      suggestedCollectionLoadId: base.loadId,
      strategy: 'HYBRID',
      defaults: {
        capacity: { value: 10, unit: 'BOOKS' },
        targetFillRatio: 1,
        allowOverflow: false,
      },
      anchors: [],
      manualRanges: [],
    });
    expect(templateResponse.body).not.toHaveProperty('positions');
    expect(templateResponse.body).not.toHaveProperty('ranges');
    expect(templateResponse.body).not.toHaveProperty('revision');
    expect(templateResponse.body).not.toHaveProperty('counters');

    const nextLoad = await seedDoneLoad(adminId, ['100', '200', '300', '400']);
    const derived = await request(app.getHttpServer())
      .post('/api/distribution-runs')
      .set('Cookie', cookie)
      .send({
        ...templateResponse.body,
        collectionLoadId: nextLoad.loadId,
        suggestedCollectionLoadId: undefined,
      })
      .expect(201);
    expect(derived.body).toMatchObject({
      schemeId: base.schemeId,
      collectionLoadId: nextLoad.loadId,
      basedOnDistributionRunId: base.runId,
      counters: { bookCount: 4 },
    });

    const comparison = await request(app.getHttpServer())
      .get(`/api/distribution-runs/${derived.body.distributionRunId}/comparison`)
      .set('Cookie', cookie)
      .expect(200);
    expect(comparison.body).toMatchObject({
      runId: derived.body.distributionRunId,
      againstRunId: base.runId,
      counterChanges: {
        assigned: 1,
        unassigned: 0,
        emptyPositions: 0,
        overloadedPositions: 0,
        splitKeys: 0,
      },
      rangeChanges: expect.any(Array),
    });

    const beforeRestore = await request(app.getHttpServer())
      .get(`/api/distribution-runs/${base.runId}`)
      .set('Cookie', cookie)
      .expect(200);
    const publishedDerived = await request(app.getHttpServer())
      .post(`/api/distribution-runs/${derived.body.distributionRunId}/publish`)
      .set('Cookie', cookie)
      .send({ expectedRevision: 1, previewAccepted: true })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/distribution-runs/${base.runId}/publish`)
      .set('Cookie', cookie)
      .send({ expectedRevision: 2, previewAccepted: true })
      .expect(200);

    const restored = await request(app.getHttpServer())
      .get(`/api/distribution-runs/${base.runId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(restored.body).toMatchObject({ isPublished: true });
    expect(restored.body.positions).toEqual(beforeRestore.body.positions);
    expect(restored.body.ranges).toEqual(beforeRestore.body.ranges);
    expect(restored.body.counters).toEqual(beforeRestore.body.counters);
    expect(publishedDerived.body.counters).toEqual(derived.body.counters);
  });

  it('rechaza linaje y comparación entre schemes distintos', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const first = await seedPublishedDistribution(adminId);
    const other = await seedDistributionStructure(adminId, 1, 'alternativa');
    const load = await seedDoneLoad(adminId);
    const otherRun = await request(app.getHttpServer())
      .post('/api/distribution-runs')
      .set('Cookie', cookie)
      .send({
        schemeId: other.schemeId,
        collectionLoadId: load.loadId,
        basedOnDistributionRunId: first.runId,
        strategy: 'HYBRID',
        defaults: {
          capacity: { value: 10, unit: 'BOOKS' },
          targetFillRatio: 1,
          allowOverflow: false,
        },
        anchors: [],
        manualRanges: [],
      })
      .expect(422);
    expect(otherRun.body.error.code).toBe('INVALID_RUN_LINEAGE');

    const validOther = await request(app.getHttpServer())
      .post('/api/distribution-runs')
      .set('Cookie', cookie)
      .send({
        schemeId: other.schemeId,
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
    await request(app.getHttpServer())
      .get(
        `/api/distribution-runs/${validOther.body.distributionRunId}/comparison?againstRunId=${first.runId}`,
      )
      .set('Cookie', cookie)
      .expect(422)
      .expect(({ body }) => expect(body.error.code).toBe('INVALID_RUN_LINEAGE'));
  });
});
