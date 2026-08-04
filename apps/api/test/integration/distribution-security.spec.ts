import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createApp,
  seedAdmin,
  seedDistributionStructure,
  seedDoneLoad,
} from '../helpers.js';

describe('frontera de seguridad de distribución', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('exige sesión en todas las rutas administrativas', async () => {
    const probes = [
      request(app.getHttpServer()).get('/api/distribution-runs'),
      request(app.getHttpServer()).get('/api/distribution-runs/1'),
      request(app.getHttpServer()).get('/api/distribution-runs/1/derivation-template'),
      request(app.getHttpServer()).get('/api/distribution-runs/1/comparison'),
      request(app.getHttpServer()).post('/api/distribution-runs').send({}),
      request(app.getHttpServer()).post('/api/distribution-runs/1/recalculate').send({}),
      request(app.getHttpServer()).post('/api/distribution-runs/1/publish').send({}),
      request(app.getHttpServer()).post('/api/distribution-runs/1/test-search').send({}),
      request(app.getHttpServer())
        .put('/api/distribution-runs/1/ranges/1/review')
        .send({}),
    ];
    const responses = await Promise.all(probes);
    expect(responses.every((response) => response.status === 401)).toBe(true);
  });

  it('deja pública solo la búsqueda y no filtra borradores ni campos administrativos', async () => {
    const adminId = await seedAdmin();
    const structure = await seedDistributionStructure(adminId, 1);
    await seedDoneLoad(adminId);
    const response = await request(app.getHttpServer())
      .post('/api/public/search')
      .send({ classificationCode: '100' })
      .expect(200);

    expect(response.body).toEqual({
      status: 'NOT_FOUND',
      matchType: null,
      approximate: true,
      message: expect.any(String),
      locations: [],
    });
    expect(JSON.stringify(response.body)).not.toContain(String(structure.schemeId));
    for (const field of [
      'strategy',
      'revision',
      'collectionLoadId',
      'distributionRunId',
      'comparableKey',
      'counters',
    ]) {
      expect(response.body).not.toHaveProperty(field);
    }
  });
});
