import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, login, seedAdmin, seedTemplate } from '../helpers.js';
import { testDb } from '../setup.js';

describe('rendimiento estructural', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it.skipIf(process.env.PERF !== '1')(
    'carga, copia y define 1.000 locations en menos de 2 segundos cada una',
    async () => {
      const adminId = await seedAdmin();
      const cookie = await login(app);
      const template = await seedTemplate(adminId, { status: 'ACTIVE' });
      const schemeId = await testDb
        .insertInto('schemes')
        .values({
          name: 'Rendimiento sintético',
          description: null,
          status: 'DRAFT',
          enabled: true,
          is_active: false,
          based_on_scheme_id: null,
          created_by: adminId,
        })
        .returning('scheme_id')
        .executeTakeFirstOrThrow();
      const root = await testDb
        .insertInto('locations')
        .values({
          scheme_id: schemeId.scheme_id,
          structure_template_id: template.templateId,
          structure_template_node_id: template.rootId,
          parent_location_id: null,
          name: 'Raíz sintética',
          sort_order: 0,
          leaf_sequence: null,
          map_element_id: null,
          enabled: true,
        })
        .returning('location_id')
        .executeTakeFirstOrThrow();
      await testDb
        .insertInto('locations')
        .values(
          Array.from({ length: 999 }, (_, index) => ({
            scheme_id: schemeId.scheme_id,
            structure_template_id: template.templateId,
            structure_template_node_id: template.positionId,
            parent_location_id: root.location_id,
            name: `Posición sintética ${index + 1}`,
            sort_order: index,
            leaf_sequence: null,
            map_element_id: null,
            enabled: true,
          })),
        )
        .execute();

      const loadStart = performance.now();
      await request(app.getHttpServer())
        .get(`/api/schemes/${schemeId.scheme_id}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(performance.now() - loadStart).toBeLessThan(2_000);

      const copyStart = performance.now();
      const copy = await request(app.getHttpServer())
        .post(`/api/schemes/${schemeId.scheme_id}/copy`)
        .set('Cookie', cookie)
        .send({ name: 'Copia de rendimiento' })
        .expect(201);
      expect(performance.now() - copyStart).toBeLessThan(2_000);

      const defineStart = performance.now();
      await request(app.getHttpServer())
        .post(`/api/schemes/${copy.body.schemeId}/define`)
        .set('Cookie', cookie)
        .expect(200);
      expect(performance.now() - defineStart).toBeLessThan(2_000);
    },
    30_000,
  );
});
