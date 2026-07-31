import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, login, seedAdmin, seedTemplate } from '../helpers.js';

describe('orden y definición de schemes', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('define atómicamente con secuencia DFS y bloquea el árbol', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const template = await seedTemplate(adminId, { status: 'ACTIVE' });
    const scheme = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Scheme definible' })
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
    const first = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.positionId,
        name: 'Primera',
      })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.positionId,
        name: 'Segunda',
      })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/api/schemes/${schemeId}/locations/order`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: root.body.locationId,
        orderedLocationIds: [second.body.locationId, first.body.locationId],
      })
      .expect(204);

    const defined = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/define`)
      .set('Cookie', cookie)
      .expect(200);
    expect(defined.body.status).toBe('DEFINED');
    expect(
      defined.body.locations[0].children.map(
        (item: { name: string; leafSequence: number }) => [item.name, item.leafSequence],
      ),
    ).toEqual([
      ['Segunda', 1],
      ['Primera', 2],
    ]);

    const rejected = await request(app.getHttpServer())
      .patch(`/api/schemes/${schemeId}/locations/${first.body.locationId}`)
      .set('Cookie', cookie)
      .send({ name: 'No cambia' })
      .expect(409);
    expect(rejected.body.error.code).toBe('SCHEME_NOT_EDITABLE');
  });

  it('rechaza definición sin POSITION utilizable y conserva DRAFT', async () => {
    const adminId = await seedAdmin();
    const cookie = await login(app);
    const template = await seedTemplate(adminId, { status: 'ACTIVE' });
    const scheme = await request(app.getHttpServer())
      .post('/api/schemes')
      .set('Cookie', cookie)
      .send({ name: 'Sin posiciones' })
      .expect(201);
    const schemeId = scheme.body.schemeId as number;
    await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/locations`)
      .set('Cookie', cookie)
      .send({
        parentLocationId: null,
        structureTemplateId: template.templateId,
        structureTemplateNodeId: template.rootId,
        name: 'Raíz',
        enabled: false,
      })
      .expect(201);
    const failure = await request(app.getHttpServer())
      .post(`/api/schemes/${schemeId}/define`)
      .set('Cookie', cookie)
      .expect(422);
    expect(failure.body.error.code).toBe('INVALID_SCHEME_TREE');
    expect(
      (
        await request(app.getHttpServer())
          .get(`/api/schemes/${schemeId}`)
          .set('Cookie', cookie)
      ).body.status,
    ).toBe('DRAFT');
  });
});
