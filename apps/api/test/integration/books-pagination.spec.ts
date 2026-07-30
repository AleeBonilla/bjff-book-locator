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
import { testDb } from '../setup.js';

/** 002-load-management, US2 y US4: paginación y presentación (FR-009 a FR-020). */
describe('paginación y presentación de registros', () => {
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

  function booksUrl(loadId: number, limit: number, offset: number, extra = ''): string {
    return `/api/collection-loads/${loadId}/books?limit=${limit}&offset=${offset}${extra}`;
  }

  it('devuelve como máximo el tamaño de página pedido (FR-009, SC-003)', async () => {
    const { cookie, loadId } = await withImport();

    const response = await request(app.getHttpServer())
      .get(booksUrl(loadId, 10, 0))
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.items).toHaveLength(10);
    expect(response.body.total).toBe(EXAMPLE_EXPECTED.rowsImported);
  });

  it('recorre la carga completa sin repeticiones ni omisiones (FR-010, SC-002)', async () => {
    const { cookie, loadId } = await withImport();

    const pageSize = 10;
    const seen: number[] = [];

    for (let offset = 0; offset < EXAMPLE_EXPECTED.rowsImported; offset += pageSize) {
      const response = await request(app.getHttpServer())
        .get(booksUrl(loadId, pageSize, offset))
        .set('Cookie', cookie)
        .expect(200);

      seen.push(...response.body.items.map((b: { bookId: number }) => b.bookId));
    }

    expect(seen).toHaveLength(EXAMPLE_EXPECTED.rowsImported);
    expect(new Set(seen).size).toBe(EXAMPLE_EXPECTED.rowsImported);
  });

  it('mantiene el orden por fila de origen entre páginas (FR-010)', async () => {
    const { cookie, loadId } = await withImport();

    const firstPage = await request(app.getHttpServer())
      .get(booksUrl(loadId, 10, 0))
      .set('Cookie', cookie)
      .expect(200);

    const secondPage = await request(app.getHttpServer())
      .get(booksUrl(loadId, 10, 10))
      .set('Cookie', cookie)
      .expect(200);

    const rows = [...firstPage.body.items, ...secondPage.body.items].map(
      (b: { sourceRowNumber: number }) => b.sourceRowNumber,
    );

    expect([...rows].sort((a, b) => a - b)).toEqual(rows);
  });

  it('devuelve una página vacía sin error más allá del total (FR-014)', async () => {
    const { cookie, loadId } = await withImport();

    const response = await request(app.getHttpServer())
      .get(booksUrl(loadId, 100, 1000))
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.items).toEqual([]);
    expect(response.body.total).toBe(EXAMPLE_EXPECTED.rowsImported);
  });

  it('pagina sobre el subconjunto filtrado (FR-013)', async () => {
    const { cookie, loadId } = await withImport();

    const response = await request(app.getHttpServer())
      .get(booksUrl(loadId, 100, 0, '&withoutKey=true'))
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.total).toBe(EXAMPLE_EXPECTED.rowsWithoutKey);
    expect(response.body.items).toHaveLength(EXAMPLE_EXPECTED.rowsWithoutKey);
  });

  it('no devuelve títulos con puntuación catalográfica final (SC-005)', async () => {
    const { cookie, loadId } = await withImport();

    const response = await request(app.getHttpServer())
      .get(booksUrl(loadId, 100, 0))
      .set('Cookie', cookie)
      .expect(200);

    for (const book of response.body.items) {
      if (book.title === null) continue;
      expect(book.title).not.toMatch(/[:/=]\s*$/);
    }

    const byBarcode = (barcode: string) =>
      response.body.items.find(
        (b: { sourceBarcode: string }) => b.sourceBarcode === barcode,
      );

    // El fixture trae `Ciencia :`, `Obra de prueba /` y `Titulo paralelo =`.
    expect(byBarcode('1007').title).toBe('Ciencia');
    expect(byBarcode('1002').title).toBe('Obra de prueba');
    expect(byBarcode('1003').title).toBe('Titulo paralelo');
  });

  it('conserva el título original en la base (FR-019, SC-005)', async () => {
    const { cookie, loadId } = await withImport();

    const response = await request(app.getHttpServer())
      .get(booksUrl(loadId, 100, 0))
      .set('Cookie', cookie)
      .expect(200);

    expect(response.body.items.length).toBeGreaterThan(0);

    const stored = await testDb
      .selectFrom('books')
      .select('title')
      .where('collection_load_id', '=', loadId)
      .where('source_barcode', '=', '1007')
      .executeTakeFirstOrThrow();

    expect(stored.title).toBe('Ciencia :');
  });
});
