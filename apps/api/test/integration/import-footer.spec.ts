import type { INestApplication } from '@nestjs/common';
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

/** T054 — Fila vacía y pie de control (FR-032, FR-033, FR-034, FR-035). */
describe('fila vacía y pie de control', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('produce 47 registros y no 49: ignora la fila vacía y el pie (FR-033)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const response = await importFile(app, cookie, exampleCsv());

    expect(response.body.counters.rowsRead).toBe(EXAMPLE_EXPECTED.rowsRead);

    const books = await testDb
      .selectFrom('books')
      .select('source_barcode')
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .execute();

    expect(books).toHaveLength(47);
    expect(books.map((row) => row.source_barcode)).not.toContain('TOTAL');
  });

  it('acepta el pie cuando el conteo coincide', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const response = await importFile(app, cookie, exampleCsv());
    expect(response.body.status).toBe('DONE');
  });

  it('termina en ERROR cuando el pie declara otro conteo (FR-032)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const text = exampleCsv().toString('utf8').replace('TOTAL;47', 'TOTAL;43');
    const response = await importFile(app, cookie, Buffer.from(text, 'utf8'));

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('ERROR');
    expect(response.body.counters.rowsImported).toBe(0);

    const books = await testDb
      .selectFrom('books')
      .select('book_id')
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .execute();

    expect(books).toHaveLength(0);
  });

  it('procesa con normalidad un archivo sin pie de control (FR-034)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const csv = ['codBarras;Clasificacion', '1001;658 A111a 23', '1002;658 B222b 23'].join(
      '\n',
    );
    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.body.status).toBe('DONE');
    expect(response.body.counters.rowsImported).toBe(2);
  });

  it('ignora una fila vacía intermedia (FR-033)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const csv = [
      'codBarras;Clasificacion',
      '1001;658 A111a 23',
      ';',
      '1002;658 B222b 23',
      '',
      'TOTAL;2',
    ].join('\n');

    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.body.status).toBe('DONE');
    expect(response.body.counters.rowsRead).toBe(2);
  });

  it('registra como problema las filas posteriores al pie (FR-035)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const csv = [
      'codBarras;Clasificacion',
      '1001;658 A111a 23',
      '',
      'TOTAL;1',
      '1002;658 B222b 23',
    ].join('\n');

    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.body.counters.rowsRejected).toBe(1);

    const books = await testDb
      .selectFrom('books')
      .select('source_barcode')
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .execute();

    expect(books.map((row) => row.source_barcode)).not.toContain('1002');
  });
});
