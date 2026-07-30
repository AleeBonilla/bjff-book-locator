import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, exampleCsv, importFile, login, seedAdmin } from '../helpers.js';
import { testDb } from '../setup.js';

/** 002-load-management, US1: eliminación de cargas (FR-001 a FR-008). */
describe('eliminación de cargas', () => {
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

  it('elimina la carga y desaparece del listado (FR-001)', async () => {
    const { cookie, loadId } = await withImport();

    await request(app.getHttpServer())
      .delete(`/api/collection-loads/${loadId}`)
      .set('Cookie', cookie)
      .expect(204);

    const listing = await request(app.getHttpServer())
      .get('/api/collection-loads')
      .set('Cookie', cookie)
      .expect(200);

    expect(listing.body.total).toBe(0);

    await request(app.getHttpServer())
      .get(`/api/collection-loads/${loadId}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('arrastra registros y problemas (FR-003, SC-001)', async () => {
    const { cookie, loadId } = await withImport();

    await request(app.getHttpServer())
      .delete(`/api/collection-loads/${loadId}`)
      .set('Cookie', cookie)
      .expect(204);

    const books = await testDb
      .selectFrom('books')
      .select('book_id')
      .where('collection_load_id', '=', loadId)
      .execute();

    const problems = await testDb
      .selectFrom('collection_load_errors')
      .select('collection_load_error_id')
      .where('collection_load_id', '=', loadId)
      .execute();

    expect(books).toHaveLength(0);
    expect(problems).toHaveLength(0);
  });

  it('no altera las demás cargas (FR-004, SC-001)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const first = await importFile(app, cookie, exampleCsv());
    const second = await importFile(app, cookie, exampleCsv());

    await request(app.getHttpServer())
      .delete(`/api/collection-loads/${first.body.collectionLoadId}`)
      .set('Cookie', cookie)
      .expect(204);

    const survivor = await request(app.getHttpServer())
      .get(`/api/collection-loads/${second.body.collectionLoadId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(survivor.body.counters).toEqual(second.body.counters);

    const books = await testDb
      .selectFrom('books')
      .select('book_id')
      .where('collection_load_id', '=', second.body.collectionLoadId)
      .execute();

    expect(books).toHaveLength(second.body.counters.rowsImported);
  });

  it('responde 404 ante una carga inexistente (FR-006)', async () => {
    const { cookie } = await withImport();

    const response = await request(app.getHttpServer())
      .delete('/api/collection-loads/999999')
      .set('Cookie', cookie)
      .expect(404);

    expect(response.body.error.code).toBe('LOAD_NOT_FOUND');
  });

  it('responde 404 al eliminar dos veces la misma carga', async () => {
    const { cookie, loadId } = await withImport();

    await request(app.getHttpServer())
      .delete(`/api/collection-loads/${loadId}`)
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .delete(`/api/collection-loads/${loadId}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('rechaza la eliminación sin sesión activa (FR-007, SC-004)', async () => {
    const { cookie, loadId } = await withImport();

    const response = await request(app.getHttpServer())
      .delete(`/api/collection-loads/${loadId}`)
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');

    // La carga sigue existiendo.
    await request(app.getHttpServer())
      .get(`/api/collection-loads/${loadId}`)
      .set('Cookie', cookie)
      .expect(200);
  });

  it('elimina también una carga terminada en ERROR', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const text = exampleCsv().toString('utf8').replace('TOTAL;47', 'TOTAL;99');
    const failed = await importFile(app, cookie, Buffer.from(text, 'utf8'));
    expect(failed.body.status).toBe('ERROR');

    await request(app.getHttpServer())
      .delete(`/api/collection-loads/${failed.body.collectionLoadId}`)
      .set('Cookie', cookie)
      .expect(204);
  });
});
