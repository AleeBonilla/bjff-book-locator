import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createApp,
  login,
  seedAdmin,
  seedDistributionStructure,
  seedDoneLoad,
} from '../helpers.js';

describe('revisión y búsqueda de prueba', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('registra y elimina una revisión opcional con control de versión', async () => {
    const fixture = await createRun(app);
    const reviewed = await request(app.getHttpServer())
      .put(`/api/distribution-runs/${fixture.runId}/ranges/${fixture.rangeId}/review`)
      .set('Cookie', fixture.cookie)
      .send({ expectedRevision: 1, notes: 'Frontera verificada' })
      .expect(200);
    expect(reviewed.body).toMatchObject({ revision: 2 });
    expect(reviewed.body.ranges[0]).toMatchObject({
      reviewNotes: 'Frontera verificada',
      reviewedBy: { username: 'admin_prueba' },
      reviewedAt: expect.any(String),
    });

    const cleared = await request(app.getHttpServer())
      .put(`/api/distribution-runs/${fixture.runId}/ranges/${fixture.rangeId}/review`)
      .set('Cookie', fixture.cookie)
      .send({ expectedRevision: 2, notes: null })
      .expect(200);
    expect(cleared.body).toMatchObject({ revision: 3 });
    expect(cleared.body.ranges[0]).toMatchObject({
      reviewNotes: null,
      reviewedBy: null,
      reviewedAt: null,
    });
  });

  it('busca dentro de un DONE no publicado sin abrir el endpoint público', async () => {
    const fixture = await createRun(app);
    await request(app.getHttpServer())
      .post(`/api/distribution-runs/${fixture.runId}/test-search`)
      .send({ classificationCode: '100' })
      .expect(401);

    const response = await request(app.getHttpServer())
      .post(`/api/distribution-runs/${fixture.runId}/test-search`)
      .set('Cookie', fixture.cookie)
      .send({ classificationCode: '100' })
      .expect(200);
    expect(response.body).toMatchObject({
      status: 'FOUND',
      matchType: 'EXACT',
      approximate: true,
      locations: [{ path: expect.any(String) }],
    });
  });

  it('rechaza códigos vacíos, ambiguos o ajenos al formato antes de buscar rangos', async () => {
    const fixture = await createRun(app);
    const invalidCodes = ['', '   ', '@@@', 'ABC', '100 OR 1=1', '100<script>'];

    for (const classificationCode of invalidCodes) {
      const response = await request(app.getHttpServer())
        .post(`/api/distribution-runs/${fixture.runId}/test-search`)
        .set('Cookie', fixture.cookie)
        .send({ classificationCode })
        .expect(422);

      expect(response.body).toEqual({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'El código no tiene un formato de clasificación utilizable.',
        },
      });
    }

    const valid = await request(app.getHttpServer())
      .post(`/api/distribution-runs/${fixture.runId}/test-search`)
      .set('Cookie', fixture.cookie)
      .send({ classificationCode: ' 100 ' })
      .expect(200);
    expect(valid.body.status).toBe('FOUND');
  });
});

async function createRun(app: INestApplication) {
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
      defaults: {
        capacity: { value: 2, unit: 'BOOKS' },
        targetFillRatio: 1,
        allowOverflow: false,
      },
      anchors: [],
      manualRanges: [],
    })
    .expect(201);
  return {
    cookie,
    runId: created.body.distributionRunId as number,
    rangeId: created.body.ranges[0].distributionRangeId as number,
  };
}
