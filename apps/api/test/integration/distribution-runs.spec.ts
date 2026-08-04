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

describe('corridas de distribución', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('protege la administración y crea una corrida DONE reproducible', async () => {
    await request(app.getHttpServer()).get('/api/distribution-runs').expect(401);
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const structure = await seedDistributionStructure(adminId, 2);
    const load = await seedDoneLoad(adminId, ['100', '200', '300']);
    const command = {
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
    };

    const first = await request(app.getHttpServer())
      .post('/api/distribution-runs')
      .set('Cookie', cookie)
      .send(command)
      .expect(201);
    expect(first.body).toMatchObject({
      status: 'DONE',
      revision: 1,
      counters: { bookCount: 3, positionCount: 2, unassignedCount: 0 },
    });
    expect(first.body.positions).toHaveLength(2);
    expect(first.body.ranges[0].startCode).toBeNull();

    const distributedScheme = await request(app.getHttpServer())
      .get(`/api/schemes/${structure.schemeId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(distributedScheme.body).toMatchObject({
      status: 'DISTRIBUTED',
      availableForNewRun: true,
      unavailableReasons: [],
    });

    const second = await request(app.getHttpServer())
      .post('/api/distribution-runs')
      .set('Cookie', cookie)
      .send(command)
      .expect(201);
    expect(second.body.ranges).toEqual(
      first.body.ranges.map((range: Record<string, unknown>) => ({
        ...range,
        distributionRangeId: expect.any(Number),
      })),
    );
  });
});
