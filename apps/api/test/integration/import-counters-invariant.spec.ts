import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, exampleCsv, importFile, login, seedAdmin } from '../helpers.js';
import { testDb } from '../setup.js';

/** T057 — Los cinco contadores y su invariante (FR-036, FR-037). */
describe('invariante de los contadores', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('informa los cinco contadores (FR-036)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const response = await importFile(app, cookie, exampleCsv());

    expect(Object.keys(response.body.counters).sort()).toEqual([
      'rowsFlagged',
      'rowsImported',
      'rowsRead',
      'rowsRejected',
      'rowsWithoutKey',
    ]);
  });

  it('cumple importadas + rechazadas = leídas (FR-037)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const csv = [
      'codBarras;Clasificacion',
      '1001;658 A111a 23',
      '1002;658 B222b 23;sobra',
      '1003;',
      // La coma decimal ya no marca: solo admite una lectura (FR-018). Se usa una
      // clase de cuatro dígitos, que sí exige decisión humana (FR-018a).
      '1004;8693.7 M378a 23',
      '',
      'TOTAL;4',
    ].join('\n');

    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));
    const counters = response.body.counters;

    expect(counters.rowsImported + counters.rowsRejected).toBe(counters.rowsRead);
    expect(counters.rowsWithoutKey).toBe(1);
    expect(counters.rowsFlagged).toBe(1);
  });

  it('cuenta como importada la fila sin clave (FR-024)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const csv = ['codBarras;Clasificacion', '1001;', '', 'TOTAL;1'].join('\n');
    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.body.counters.rowsImported).toBe(1);
    expect(response.body.counters.rowsWithoutKey).toBe(1);
  });

  it('persiste los contadores en la carga', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const response = await importFile(app, cookie, exampleCsv());

    const stored = await testDb
      .selectFrom('collection_loads')
      .selectAll()
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .executeTakeFirstOrThrow();

    expect(stored.rows_read).toBe(response.body.counters.rowsRead);
    expect(stored.rows_imported).toBe(response.body.counters.rowsImported);
    expect(stored.rows_without_key).toBe(response.body.counters.rowsWithoutKey);
    expect(stored.rows_flagged).toBe(response.body.counters.rowsFlagged);
    expect(stored.rows_rejected).toBe(response.body.counters.rowsRejected);
  });
});
