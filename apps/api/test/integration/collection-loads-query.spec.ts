import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  EXAMPLE_EXPECTED,
  createApp,
  exampleCsv,
  importFile,
  login,
  seedAdmin,
} from '../helpers.js';

/** T061 — Consulta del resumen, los problemas y los registros (FR-040 a FR-042). */
describe('consulta de cargas', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function withImport() {
    await seedAdmin();
    const cookie = await login(app);
    const response = await importFile(app, cookie, exampleCsv());
    return { cookie, loadId: response.body.collectionLoadId as number };
  }

  it('lista las cargas con sus contadores (FR-040)', async () => {
    const { cookie } = await withImport();

    const response = await request(app.getHttpServer())
      .get('/api/collection-loads')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.items[0].counters).toEqual(EXAMPLE_EXPECTED);
    expect(response.body.items[0].createdBy.username).toBe('admin_prueba');
  });

  it('ordena las cargas por fecha de creación descendente (FR-041)', async () => {
    const { cookie } = await withImport();
    await importFile(app, cookie, exampleCsv());

    const response = await request(app.getHttpServer())
      .get('/api/collection-loads')
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.total).toBe(2);
    expect(response.body.items[0].collectionLoadId).toBeGreaterThan(
      response.body.items[1].collectionLoadId,
    );
  });

  it('devuelve el detalle de una carga', async () => {
    const { cookie, loadId } = await withImport();

    const response = await request(app.getHttpServer())
      .get(`/api/collection-loads/${loadId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.status).toBe('DONE');
    expect(response.body.errorMessage).toBeNull();
  });

  it('responde 404 para una carga inexistente', async () => {
    const { cookie } = await withImport();

    const response = await request(app.getHttpServer())
      .get('/api/collection-loads/999999')
      .set('Cookie', cookie)
      .expect(404);

    expect(response.body.error.code).toBe('LOAD_NOT_FOUND');
  });

  it('lista los problemas ordenados por número de fila (FR-038, SC-008)', async () => {
    const { cookie, loadId } = await withImport();

    const response = await request(app.getHttpServer())
      .get(`/api/collection-loads/${loadId}/errors`)
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.total).toBe(EXAMPLE_EXPECTED.rowsFlagged);

    const rowNumbers = response.body.items.map(
      (item: { rowNumber: number }) => item.rowNumber,
    );
    expect([...rowNumbers].sort((a, b) => a - b)).toEqual(rowNumbers);

    for (const item of response.body.items) {
      expect(item.rowNumber).toBeGreaterThan(0);
      expect(item.severity).toBe('REVIEW');
      expect(item.reason.length).toBeGreaterThan(0);
      // FR-038a: el código original acompaña al problema. Sin él, el motivo no
      // permite entender qué corregir.
      expect(item.classificationRaw).not.toBeNull();
    }

    const codes = response.body.items.map(
      (item: { classificationRaw: string }) => item.classificationRaw,
    );
    expect(codes).toContain('8693.7 M378a 23');
    expect(codes).toContain('658 W721 A6 XYZ');
    expect(codes).toContain('Zz863 A777a 23');
  });

  it('filtra los problemas por severidad', async () => {
    const { cookie, loadId } = await withImport();

    const rejected = await request(app.getHttpServer())
      .get(`/api/collection-loads/${loadId}/errors?severity=REJECTED`)
      .set('Cookie', cookie)
      .expect(200);

    expect(rejected.body.total).toBe(0);
  });

  it('lista los registros ordenados por fila de origen', async () => {
    const { cookie, loadId } = await withImport();

    const response = await request(app.getHttpServer())
      .get(`/api/collection-loads/${loadId}/books?limit=5`)
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.total).toBe(EXAMPLE_EXPECTED.rowsImported);
    expect(response.body.items).toHaveLength(5);
    expect(response.body.items[0].sourceRowNumber).toBe(2);
    expect(response.body.items[0].classificationRaw).toBe('001.4 B268-i-2 23');
  });

  it('permite filtrar los registros sin clave comparable', async () => {
    const { cookie, loadId } = await withImport();

    const response = await request(app.getHttpServer())
      .get(`/api/collection-loads/${loadId}/books?withoutKey=true`)
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.total).toBe(EXAMPLE_EXPECTED.rowsWithoutKey);
    expect(response.body.items[0].comparableKey).toBeNull();
  });

  it('rechaza toda consulta sin sesión (FR-042)', async () => {
    const { loadId } = await withImport();

    for (const path of [
      '/api/collection-loads',
      `/api/collection-loads/${loadId}`,
      `/api/collection-loads/${loadId}/errors`,
      `/api/collection-loads/${loadId}/books`,
    ]) {
      const response = await request(app.getHttpServer()).get(path).expect(401);
      expect(JSON.stringify(response.body)).not.toContain('B268');
    }
  });
});
