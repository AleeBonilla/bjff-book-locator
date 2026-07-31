import { sql } from 'kysely';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, login, seedAdmin, seedTemplate } from '../helpers.js';
import { testDb } from '../setup.js';

const DISTRIBUTION_TABLES = [
  'distribution_runs',
  'distribution_position_inputs',
  'distribution_anchors',
  'distribution_ranges',
  'book_placements',
] as const;

describe('límite previo a distribución', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('no escribe corridas, entradas, anchors, rangos ni placements', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const template = await seedTemplate(adminId, { status: 'ACTIVE' });
    const scheme = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Sin distribución' })
      .expect(201);
    const root = await request(app.getHttpServer())
      .post(`/api/schemes/${scheme.body.schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: null,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.rootId,
        name: 'Raíz',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/schemes/${scheme.body.schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.positionId,
        name: 'Posición',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/schemes/${scheme.body.schemeId}/define`)
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/schemes/${scheme.body.schemeId}/copy`)
      .set('Cookie', cookie)
      .send({ name: 'Otra propuesta' })
      .expect(201);

    for (const table of DISTRIBUTION_TABLES) {
      const result = await sql<{
        count: string;
      }>`SELECT count(*)::text AS count FROM ${sql.table(table)}`.execute(testDb);
      expect(Number(result.rows[0]!.count), table).toBe(0);
    }
  });
});
