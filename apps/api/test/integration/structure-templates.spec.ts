import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, login, seedAdmin } from '../helpers.js';

describe('plantillas de estructura', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function session(): Promise<string> {
    await seedAdmin();
    return login(app);
  }

  it('exige sesión y crea/lista un DRAFT atribuible', async () => {
    await request(app.getHttpServer()).get('/api/structure-templates').expect(401);
    const cookie = await session();

    const created = await request(app.getHttpServer())
      .post('/api/structure-templates')
      .set('Cookie', cookie)
      .send({ name: 'Sección tradicional', description: 'Árbol de prueba' })
      .expect(201);

    expect(created.body).toMatchObject({
      name: 'Sección tradicional',
      status: 'DRAFT',
      enabled: true,
      nodes: [],
      createdBy: { username: 'admin_prueba' },
    });

    const page = await request(app.getHttpServer())
      .get('/api/structure-templates')
      .set('Cookie', cookie)
      .expect(200);
    expect(page.body.total).toBe(1);
  });

  it('crea un árbol válido, lo activa y después lo protege', async () => {
    const cookie = await session();
    const template = await request(app.getHttpServer())
      .post('/api/structure-templates')
      .set('Cookie', cookie)
      .send({ name: 'Sección activa' })
      .expect(201);

    const templateId = template.body.structureTemplateId as number;
    const root = await request(app.getHttpServer())
      .post(`/api/structure-templates/${templateId}/nodes`)
      .set('Cookie', cookie)
      .send({
        parentTemplateNodeId: null,
        name: 'Sección',
        role: 'CONTAINER',
        position: 0,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/structure-templates/${templateId}/nodes`)
      .set('Cookie', cookie)
      .send({
        parentTemplateNodeId: root.body.structureTemplateNodeId,
        name: 'Anaquel',
        role: 'POSITION',
        defaults: {
          capacity: { value: 40, unit: 'BOOKS' },
          targetFillRatio: 0.85,
          allowOverflow: true,
        },
      })
      .expect(201);

    const active = await request(app.getHttpServer())
      .post(`/api/structure-templates/${templateId}/activate`)
      .set('Cookie', cookie)
      .expect(200);
    expect(active.body.status).toBe('ACTIVE');

    const rejected = await request(app.getHttpServer())
      .post(`/api/structure-templates/${templateId}/nodes`)
      .set('Cookie', cookie)
      .send({
        parentTemplateNodeId: root.body.structureTemplateNodeId,
        name: 'Otra',
        role: 'POSITION',
      })
      .expect(409);
    expect(rejected.body.error.code).toBe('TEMPLATE_NOT_EDITABLE');
  });

  it('rechaza hijas de POSITION y activación sin posición utilizable', async () => {
    const cookie = await session();
    const template = await request(app.getHttpServer())
      .post('/api/structure-templates')
      .set('Cookie', cookie)
      .send({ name: 'Plantilla inválida' })
      .expect(201);
    const templateId = template.body.structureTemplateId as number;

    const root = await request(app.getHttpServer())
      .post(`/api/structure-templates/${templateId}/nodes`)
      .set('Cookie', cookie)
      .send({
        parentTemplateNodeId: null,
        name: 'Posición deshabilitada',
        role: 'POSITION',
        enabled: false,
      })
      .expect(201);

    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/structure-templates/${templateId}/nodes`)
          .set('Cookie', cookie)
          .send({
            parentTemplateNodeId: root.body.structureTemplateNodeId,
            name: 'Hija imposible',
            role: 'POSITION',
          })
          .expect(422)
      ).body.error.code,
    ).toBe('INVALID_PARENT');

    expect(
      (
        await request(app.getHttpServer())
          .post(`/api/structure-templates/${templateId}/activate`)
          .set('Cookie', cookie)
          .expect(422)
      ).body.error.code,
    ).toBe('INVALID_TEMPLATE_TREE');
  });

  it('previsualiza y exige confirmación para eliminar un subárbol', async () => {
    const cookie = await session();
    const template = await request(app.getHttpServer())
      .post('/api/structure-templates')
      .set('Cookie', cookie)
      .send({ name: 'Plantilla borrable' })
      .expect(201);
    const templateId = template.body.structureTemplateId as number;
    const root = await request(app.getHttpServer())
      .post(`/api/structure-templates/${templateId}/nodes`)
      .set('Cookie', cookie)
      .send({ parentTemplateNodeId: null, name: 'Raíz', role: 'CONTAINER' })
      .expect(201);
    const rootId = root.body.structureTemplateNodeId as number;
    await request(app.getHttpServer())
      .post(`/api/structure-templates/${templateId}/nodes`)
      .set('Cookie', cookie)
      .send({ parentTemplateNodeId: rootId, name: 'Hoja', role: 'POSITION' })
      .expect(201);

    const preview = await request(app.getHttpServer())
      .get(`/api/structure-templates/${templateId}/nodes/${rootId}/deletion-preview`)
      .set('Cookie', cookie)
      .expect(200);
    expect(preview.body.descendantCount).toBe(1);

    await request(app.getHttpServer())
      .delete(`/api/structure-templates/${templateId}/nodes/${rootId}`)
      .set('Cookie', cookie)
      .expect(409);

    await request(app.getHttpServer())
      .delete(`/api/structure-templates/${templateId}/nodes/${rootId}?confirmed=true`)
      .set('Cookie', cookie)
      .expect(204);

    const detail = await request(app.getHttpServer())
      .get(`/api/structure-templates/${templateId}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detail.body.nodes).toEqual([]);
  });
});
