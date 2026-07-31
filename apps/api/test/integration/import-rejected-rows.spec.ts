import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, importFile, login, seedAdmin } from '../helpers.js';
import { testDb } from '../setup.js';

/** T048 — Fila ilegible: se marca REJECTED y el resto continúa (FR-039). */
describe('filas ilegibles', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('marca la fila con más campos que el encabezado y sigue con el resto', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const csv = [
      'codBarras;Clasificacion;Titulo',
      '1001;658 A111a 23;Obra uno',
      '1002;658 B222b 23;Obra dos;campo;de;mas',
      '1003;658 C333c 23;Obra tres',
      '',
      'TOTAL;3',
    ].join('\n');

    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DONE');
    expect(response.body.counters).toMatchObject({
      rowsRead: 3,
      rowsImported: 2,
      rowsRejected: 1,
    });

    const problems = await testDb
      .selectFrom('collection_load_errors')
      .selectAll()
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .where('severity', '=', 'REJECTED')
      .execute();

    expect(problems).toHaveLength(1);
    expect(problems[0]!.row_number).toBe(3);
  });

  it('marca la fila sin código de barras y conserva las demás', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const csv = [
      'codBarras;Clasificacion',
      '1001;658 A111a 23',
      ';658 B222b 23',
      '',
      'TOTAL;2',
    ].join('\n');

    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.body.counters).toMatchObject({
      rowsRead: 2,
      rowsImported: 1,
      rowsRejected: 1,
    });
  });

  it('importa sin clave la fila cuyo código está vacío, sin rechazarla (FR-024)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const csv = ['codBarras;Clasificacion', '1001;', '', 'TOTAL;1'].join('\n');
    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.body.counters).toMatchObject({
      rowsRead: 1,
      rowsImported: 1,
      rowsWithoutKey: 1,
      rowsRejected: 0,
    });

    const book = await testDb
      .selectFrom('books')
      .select('comparable_key')
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .executeTakeFirstOrThrow();

    expect(book.comparable_key).toBeNull();
  });
});
