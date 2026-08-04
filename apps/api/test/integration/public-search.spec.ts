import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { testDb } from '../setup.js';
import { createApp, seedAdmin, seedPublishedDistribution } from '../helpers.js';

describe('búsqueda pública', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('es anónima y limita coincidencia exacta a la versión publicada', async () => {
    const adminId = await seedAdmin();
    await seedPublishedDistribution(adminId);
    const response = await request(app.getHttpServer())
      .post('/api/public/search')
      .send({ classificationCode: '100' })
      .expect(200);
    expect(response.body).toMatchObject({
      status: 'FOUND',
      matchType: 'EXACT',
      approximate: true,
      locations: [{ path: expect.any(String) }],
    });
    expect(response.body).not.toHaveProperty('distributionRunId');
  });

  it('resuelve la cobertura semiabierta desde inicio global hasta el sentinel', async () => {
    const adminId = await seedAdmin();
    await seedPublishedDistribution(adminId);
    const response = await request(app.getHttpServer())
      .post('/api/public/search')
      .send({ classificationCode: '250' })
      .expect(200);
    expect(response.body).toMatchObject({ status: 'FOUND', matchType: 'RANGE' });
  });

  it('no usa rango si el registro exacto quedó sin placement', async () => {
    const adminId = await seedAdmin();
    const seeded = await seedPublishedDistribution(adminId);
    await testDb
      .deleteFrom('book_placements')
      .where('book_id', '=', seeded.bookIds[0]!)
      .execute();
    const response = await request(app.getHttpServer())
      .post('/api/public/search')
      .send({ classificationCode: '100' })
      .expect(200);
    expect(response.body).toMatchObject({
      status: 'NOT_FOUND',
      matchType: null,
      locations: [],
    });
  });

  it('responde sin ubicación cuando no existe publicación', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/search')
      .send({ classificationCode: '100' })
      .expect(200);
    expect(response.body.status).toBe('NOT_FOUND');
  });
});
