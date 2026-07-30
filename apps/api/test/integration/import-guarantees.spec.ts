import { readFileSync, statSync } from 'node:fs';
import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  EXAMPLE_CSV_PATH,
  createApp,
  exampleCsv,
  importFile,
  login,
  seedAdmin,
} from '../helpers.js';
import { testDb } from '../setup.js';

/** T028 — Garantías de la importación (FR-015, FR-027, FR-028, FR-029, FR-031). */
describe('garantías de la importación', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('no modifica el archivo de origen (FR-015)', async () => {
    const before = readFileSync(EXAMPLE_CSV_PATH);
    const sizeBefore = statSync(EXAMPLE_CSV_PATH).size;

    await seedAdmin();
    const cookie = await login(app);
    await importFile(app, cookie, exampleCsv());

    expect(statSync(EXAMPLE_CSV_PATH).size).toBe(sizeBefore);
    expect(readFileSync(EXAMPLE_CSV_PATH).equals(before)).toBe(true);
  });

  it('acepta códigos de barras repetidos sin rechazar filas (FR-031)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const text = exampleCsv().toString('utf8');
    const lines = text.split('\n');
    // Se duplica el código de barras de la segunda fila de datos en la tercera.
    lines[2] = lines[2]!.replace(/^1002;/, '1001;');
    const modified = Buffer.from(lines.join('\n'), 'utf8');

    const response = await importFile(app, cookie, modified);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DONE');
    expect(response.body.counters.rowsRejected).toBe(0);

    const duplicated = await testDb
      .selectFrom('books')
      .select('book_id')
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .where('source_barcode', '=', '1001')
      .execute();

    expect(duplicated).toHaveLength(2);
  });

  it('crea cargas independientes que no se modifican entre sí (FR-027)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const first = await importFile(app, cookie, exampleCsv());
    const second = await importFile(app, cookie, exampleCsv());

    expect(first.body.collectionLoadId).not.toBe(second.body.collectionLoadId);

    const firstAfter = await testDb
      .selectFrom('collection_loads')
      .selectAll()
      .where('collection_load_id', '=', first.body.collectionLoadId)
      .executeTakeFirstOrThrow();

    expect(firstAfter.status).toBe('DONE');
    expect(firstAfter.rows_imported).toBe(first.body.counters.rowsImported);
  });

  it('no condiciona una importación al estado de otra (FR-029)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const [a, b] = await Promise.all([
      importFile(app, cookie, exampleCsv()),
      importFile(app, cookie, exampleCsv()),
    ]);

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.status).toBe('DONE');
    expect(b.body.status).toBe('DONE');
    expect(a.body.collectionLoadId).not.toBe(b.body.collectionLoadId);
  });

  it('deja cero registros disponibles cuando la importación falla (FR-028, SC-007)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    // Se altera el pie para forzar el fallo de FR-032.
    const text = exampleCsv().toString('utf8').replace('TOTAL;47', 'TOTAL;99');
    const response = await importFile(app, cookie, Buffer.from(text, 'utf8'));

    expect(response.body.status).toBe('ERROR');

    const books = await testDb
      .selectFrom('books')
      .select('book_id')
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .execute();

    expect(books).toHaveLength(0);
  });

  it('acepta una importación nueva después de una fallida (SC-007a)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const failedText = exampleCsv().toString('utf8').replace('TOTAL;47', 'TOTAL;99');
    const failed = await importFile(app, cookie, Buffer.from(failedText, 'utf8'));
    expect(failed.body.status).toBe('ERROR');

    const recovered = await importFile(app, cookie, exampleCsv());
    expect(recovered.body.status).toBe('DONE');
  });
});
