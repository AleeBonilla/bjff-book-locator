import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, login, seedAdmin, seedTemplate } from '../helpers.js';

describe('archivo, habilitación y disponibilidad', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('archiva sin invalidar instancias y deshabilita de forma reversible', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const template = await seedTemplate(adminId, { status: 'ACTIVE' });
    const scheme = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Histórico' })
      .expect(201);
    const schemeId = scheme.body.schemeId as number;
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
      .post(`/api/schemes/${schemeId}/define`)
      .set('Cookie', cookie)
      .expect(200);

    const archived = await request(app.getHttpServer())
      .post(`/api/structure-templates/${template.templateId}/archive`)
      .set('Cookie', cookie)
      .expect(200);
    expect(archived.body.status).toBe('ARCHIVED');
    let detail = await request(app.getHttpServer())
      .get(`/api/schemes/${schemeId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detail.body.availableForNewRun).toBe(true);
    expect(detail.body.locations[0].children[0].usable).toBe(true);
    expect(detail.body.locations[0].children[0].leafSequence).toBe(1);

    await request(app.getHttpServer())
      .patch(`/api/structure-templates/${template.templateId}`)
      .set('Cookie', cookie)
      .send({ enabled: false })
      .expect(200);
    detail = await request(app.getHttpServer())
      .get(`/api/schemes/${schemeId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detail.body.status).toBe('DEFINED');
    expect(detail.body.availableForNewRun).toBe(false);
    expect(detail.body.unavailableReasons).toContain('TEMPLATE_DISABLED');
    expect(detail.body.locations[0].children[0].leafSequence).toBe(1);
    expect(detail.body.locations[0].children[0].usable).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/structure-templates/${template.templateId}`)
      .set('Cookie', cookie)
      .send({ enabled: true })
      .expect(200);
    detail = await request(app.getHttpServer())
      .get(`/api/schemes/${schemeId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detail.body.availableForNewRun).toBe(true);
  });

  it('mantiene administrable un scheme deshabilitado', async () => {
    await seedAdmin();
    const cookie = await login(app);
    const scheme = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Temporalmente retirado' })
      .expect(201);
    const updated = await request(app.getHttpServer())
      .patch(`/api/schemes/${scheme.body.schemeId}`)
      .set('Cookie', cookie)
      .send({ enabled: false, description: 'Sigue administrable' })
      .expect(200);
    expect(updated.body.enabled).toBe(false);
    expect(updated.body.description).toBe('Sigue administrable');
    expect(updated.body.unavailableReasons).toContain('SCHEME_DISABLED');
  });
});
