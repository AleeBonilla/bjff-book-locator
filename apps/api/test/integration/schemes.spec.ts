import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, login, seedAdmin, seedTemplate } from '../helpers.js';

describe('schemes y locations', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('exige sesión y crea un scheme DRAFT vacío', async () => {
    await request(app.getHttpServer()).get('/api/schemes').expect(401);
    await seedAdmin();
    const cookie = await login(app);
    const response = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Planta principal' })
      .expect(201);
    expect(response.body).toMatchObject({
      name: 'Planta principal',
      status: 'DRAFT',
      enabled: true,
      locations: [],
    });
  });

  it('instancia dos plantillas y repite posiciones con identidades propias', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const section = await seedTemplate(adminId, {
      name: 'Sección sintética',
      status: 'ACTIVE',
    });
    const archive = await seedTemplate(adminId, {
      name: 'Archivador sintético',
      status: 'ACTIVE',
    });
    const scheme = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Scheme heterogéneo' })
      .expect(201);
    const schemeId = scheme.body.schemeId as number;

    const root = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: null,
        structureTemplateId: section.templateId,
        structureTemplateNodeId: section.rootId,
        name: 'Sección A',
      })
      .expect(201);

    const first = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        structureTemplateId: section.templateId,
        structureTemplateNodeId: section.positionId,
        name: 'Anaquel 1',
      })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        structureTemplateId: section.templateId,
        structureTemplateNodeId: section.positionId,
        name: 'Anaquel 2',
      })
      .expect(201);
    expect(first.body.locationId).not.toBe(second.body.locationId);

    await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: null,
        structureTemplateId: archive.templateId,
        structureTemplateNodeId: archive.rootId,
        name: 'Archivador',
      })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/schemes/${schemeId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detail.body.locations).toHaveLength(2);
    expect(detail.body.locations[0].children).toHaveLength(2);
  });

  it('rechaza una relación de plantilla incompatible sin cambios parciales', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const firstTemplate = await seedTemplate(adminId, { status: 'ACTIVE' });
    const otherTemplate = await seedTemplate(adminId, {
      name: 'Otra plantilla',
      status: 'ACTIVE',
    });
    const scheme = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Jerarquía protegida' })
      .expect(201);
    const schemeId = scheme.body.schemeId as number;
    const root = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: null,
        structureTemplateId: firstTemplate.templateId,
        structureTemplateNodeId: firstTemplate.rootId,
        name: 'Raíz',
      })
      .expect(201);

    const failure = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        structureTemplateId: otherTemplate.templateId,
        structureTemplateNodeId: otherTemplate.positionId,
        name: 'Hija incompatible',
      })
      .expect(422);
    expect(failure.body.error.code).toBe('INVALID_PARENT');

    const detail = await request(app.getHttpServer())
      .get(`/api/schemes/${schemeId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detail.body.locations[0].children).toEqual([]);
  });
});
