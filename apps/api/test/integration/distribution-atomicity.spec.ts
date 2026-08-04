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

describe('atomicidad del primer cálculo', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('deja ERROR con diagnóstico y cero resultados parciales', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const structure = await seedDistributionStructure(adminId, 2);
    const load = await seedDoneLoad(adminId);

    const response = await request(app.getHttpServer())
      .post('/api/distribution-runs')
      .set('Cookie', cookie)
      .send({
        schemeId: structure.schemeId,
        collectionLoadId: load.loadId,
        strategy: 'ANCHORED',
        defaults: {
          capacity: null,
          targetFillRatio: 1,
          allowOverflow: false,
        },
        anchors: [],
        manualRanges: [],
      })
      .expect(422);

    const runId = response.body.error.details.runId as number;
    const run = await testDb
      .selectFrom('distribution_runs')
      .select(['status', 'error_message'])
      .where('distribution_run_id', '=', runId)
      .executeTakeFirstOrThrow();
    expect(run.status).toBe('ERROR');
    expect(run.error_message).toBeTruthy();
    for (const table of [
      'distribution_position_inputs',
      'distribution_anchors',
      'distribution_ranges',
      'book_placements',
    ] as const) {
      const count = await testDb
        .selectFrom(table)
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .where('distribution_run_id', '=', runId)
        .executeTakeFirstOrThrow();
      expect(Number(count.count)).toBe(0);
    }
  });
});
