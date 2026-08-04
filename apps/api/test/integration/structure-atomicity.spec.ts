import type { INestApplication } from '@nestjs/common';
import { sql } from 'kysely';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, login, seedAdmin, seedTemplate } from '../helpers.js';
import { testDb } from '../setup.js';

describe('atomicidad estructural', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('no deja cambios parciales ante orden, borrado, definición o copia inválidos', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const template = await seedTemplate(adminId, { status: 'ACTIVE' });
    const source = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Atómico' })
      .expect(201);
    const schemeId = source.body.schemeId as number;
    const root = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: null,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.rootId,
        name: 'Raíz',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.positionId,
        name: 'Posición',
      })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/api/schemes/${schemeId}/locations/order`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        orderedLocationIds: [],
      })
      .expect(422);
    await request(app.getHttpServer())
      .delete(`/api/schemes/${schemeId}/locations/${root.body.locationId}`)
      .set('Cookie', cookie)
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/api/schemes/${schemeId}/locations/${root.body.locationId}`)
      .set('Cookie', cookie)
      .send({ enabled: false })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/define`)
      .set('Cookie', cookie)
      .expect(422);
    await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/copy`)
      .set('Cookie', cookie)
      .send({ name: 'Atómico' })
      .expect(409);

    const detail = await request(app.getHttpServer())
      .get(`/api/schemes/${schemeId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detail.body.status).toBe('DRAFT');
    expect(detail.body.locations).toHaveLength(1);
    expect(detail.body.locations[0].children).toHaveLength(1);
    expect(detail.body.locations[0].children[0].name).toBe('Posición');
  });

  it('revierte cabecera y locations si la copia falla después de comenzar', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const template = await seedTemplate(adminId, { status: 'ACTIVE' });
    const source = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Origen para fallo' })
      .expect(201);
    const root = await request(app.getHttpServer())
      .post(`/api/schemes/${source.body.schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: null,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.rootId,
        name: 'Raíz',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/schemes/${source.body.schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.positionId,
        name: 'Posición',
      })
      .expect(201);

    await sql
      .raw(
        `
      CREATE FUNCTION test_fail_structure_copy() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.scheme_id <> ${Number(source.body.schemeId)} AND NEW.name = 'Posición' THEN
          RAISE EXCEPTION 'fallo sintético de copia';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_fail_structure_copy_trigger
      BEFORE INSERT ON locations
      FOR EACH ROW EXECUTE FUNCTION test_fail_structure_copy();
    `,
      )
      .execute(testDb);

    try {
      await request(app.getHttpServer())
        .post(`/api/schemes/${source.body.schemeId}/copy`)
        .set('Cookie', cookie)
        .send({ name: 'Copia que debe revertirse' })
        .expect(500);
      const partial = await testDb
        .selectFrom('schemes')
        .select('scheme_id')
        .where('name', '=', 'Copia que debe revertirse')
        .executeTakeFirst();
      expect(partial).toBeUndefined();
    } finally {
      await sql
        .raw(
          `
        DROP TRIGGER IF EXISTS test_fail_structure_copy_trigger ON locations;
        DROP FUNCTION IF EXISTS test_fail_structure_copy();
      `,
        )
        .execute(testDb);
    }
  });
});
