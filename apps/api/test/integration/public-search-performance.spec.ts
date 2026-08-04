import { performance } from 'node:perf_hooks';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, seedAdmin, seedPublishedDistribution } from '../helpers.js';

describe('rendimiento sintético de búsqueda pública', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('resuelve al menos 95 % de 40 consultas concurrentes en menos de un segundo', async () => {
    const adminId = await seedAdmin();
    await seedPublishedDistribution(adminId);

    const durations = await Promise.all(
      Array.from({ length: 40 }, async () => {
        const startedAt = performance.now();
        await request(app.getHttpServer())
          .post('/api/public/search')
          .send({ classificationCode: '100' })
          .expect(200);
        return performance.now() - startedAt;
      }),
    );

    expect(
      durations.filter((duration) => duration < 1_000).length,
    ).toBeGreaterThanOrEqual(38);
  });
});
