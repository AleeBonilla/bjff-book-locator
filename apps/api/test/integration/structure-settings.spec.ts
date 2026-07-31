import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, login, seedAdmin, seedTemplate } from '../helpers.js';

describe('settings de locations', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('deriva herencia por rol, permite editar DEFINED y elimina con tres nulos', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const template = await seedTemplate(adminId, { status: 'ACTIVE' });
    const scheme = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Settings' })
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
    const position = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.positionId,
        name: 'Posición',
      })
      .expect(201);

    const inherited = await request(app.getHttpServer())
      .put(`/api/schemes/${schemeId}/locations/${root.body.locationId}/settings`)
      .set('Cookie', cookie)
      .send({ capacity: null, targetFillRatio: 0.8, allowOverflow: null })
      .expect(200);
    expect(inherited.body.settings.inheritToDescendants).toBe(true);

    const specific = await request(app.getHttpServer())
      .put(`/api/schemes/${schemeId}/locations/${position.body.locationId}/settings`)
      .set('Cookie', cookie)
      .send({
        capacity: { value: 40, unit: 'BOOKS' },
        targetFillRatio: null,
        allowOverflow: false,
      })
      .expect(200);
    expect(specific.body.settings.inheritToDescendants).toBe(false);

    await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/define`)
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/schemes/${schemeId}/locations/${position.body.locationId}/settings`)
      .set('Cookie', cookie)
      .send({ capacity: null, targetFillRatio: null, allowOverflow: null })
      .expect(204);
    const detail = await request(app.getHttpServer())
      .get(`/api/schemes/${schemeId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detail.body.status).toBe('DEFINED');
    expect(detail.body.locations[0].children[0].leafSequence).toBe(1);
    expect(detail.body.locations[0].children[0].settings).toBeNull();
  });
});
