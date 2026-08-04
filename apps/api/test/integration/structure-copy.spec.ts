import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, login, seedAdmin, seedTemplate } from '../helpers.js';

describe('copia de schemes', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('copia árbol/settings con IDs nuevos, linaje y secuencia limpia', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const template = await seedTemplate(adminId, { status: 'ACTIVE' });
    const source = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Origen' })
      .expect(201);
    const sourceId = source.body.schemeId as number;
    const root = await request(app.getHttpServer())
      .post(`/api/schemes/${sourceId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: null,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.rootId,
        name: 'Raíz',
        mapElementId: 'map-root',
      })
      .expect(201);
    const position = await request(app.getHttpServer())
      .post(`/api/schemes/${sourceId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.positionId,
        name: 'Posición',
      })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/api/schemes/${sourceId}/locations/${position.body.locationId}/settings`)
      .set('Cookie', cookie)
      .send({
        capacity: { value: 40, unit: 'BOOKS' },
        targetFillRatio: null,
        allowOverflow: false,
      })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/schemes/${sourceId}/define`)
      .set('Cookie', cookie)
      .expect(200);

    const copied = await request(app.getHttpServer())
      .post(`/api/schemes/${sourceId}/copy`)
      .set('Cookie', cookie)
      .send({ name: 'Copia editable', description: 'Reorganización' })
      .expect(201);
    expect(copied.body).toMatchObject({
      status: 'DRAFT',
      enabled: true,
      basedOnSchemeId: sourceId,
    });
    expect(copied.body.schemeId).not.toBe(sourceId);
    expect(copied.body.locations[0].locationId).not.toBe(root.body.locationId);
    expect(copied.body.locations[0].mapElementId).toBe('map-root');
    expect(copied.body.locations[0].children[0].leafSequence).toBeNull();
    expect(copied.body.locations[0].children[0].settings.capacity.value).toBe(40);

    await request(app.getHttpServer())
      .patch(
        `/api/schemes/${copied.body.schemeId}/locations/${copied.body.locations[0].children[0].locationId}`,
      )
      .set('Cookie', cookie)
      .send({ name: 'Cambiada solo en copia' })
      .expect(200);
    const original = await request(app.getHttpServer())
      .get(`/api/schemes/${sourceId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(original.body.locations[0].children[0].name).toBe('Posición');

    const conflict = await request(app.getHttpServer())
      .post(`/api/schemes/${sourceId}/copy`)
      .set('Cookie', cookie)
      .send({ name: 'Copia editable' })
      .expect(409);
    expect(conflict.body.error.code).toBe('SCHEME_NAME_CONFLICT');
  });
});
