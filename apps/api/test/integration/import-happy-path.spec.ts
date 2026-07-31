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

/** T027 — Recorrido completo de la importación (FR-016, FR-030). */
describe('importación del archivo de ejemplo', () => {
  let app: INestApplication;
  let cookie: string;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function importExample() {
    await seedAdmin();
    cookie = await login(app);
    return importFile(app, cookie, exampleCsv());
  }

  it('termina la carga en DONE', async () => {
    const response = await importExample();
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DONE');
  });

  it('crea un registro por fila de datos', async () => {
    const response = await importExample();
    const loadId = response.body.collectionLoadId;

    const rows = await testDb
      .selectFrom('books')
      .selectAll()
      .where('collection_load_id', '=', loadId)
      .execute();

    expect(rows).toHaveLength(EXAMPLE_EXPECTED.rowsImported);
  });

  it('conserva el código de clasificación original sin alterar (FR-016)', async () => {
    const response = await importExample();
    const loadId = response.body.collectionLoadId;

    const row = await testDb
      .selectFrom('books')
      .select(['classification_raw', 'comparable_key'])
      .where('collection_load_id', '=', loadId)
      .where('source_barcode', '=', '1005')
      .executeTakeFirstOrThrow();

    // La fila de la coma decimal: el original se conserva, la clave se normaliza.
    expect(row.classification_raw).toBe('352,85 C333c 23');
    expect(row.comparable_key).not.toBeNull();
    expect(row.comparable_key).not.toContain(',');
  });

  it('conserva el número de fila del archivo de origen (FR-030)', async () => {
    const response = await importExample();
    const loadId = response.body.collectionLoadId;

    const first = await testDb
      .selectFrom('books')
      .select(['source_row_number', 'source_barcode'])
      .where('collection_load_id', '=', loadId)
      .orderBy('source_row_number', 'asc')
      .executeTakeFirstOrThrow();

    // El encabezado es la línea 1: la primera fila de datos es la 2.
    expect(first.source_row_number).toBe(2);
    expect(first.source_barcode).toBe('1001');
  });

  it('lee completo un campo entrecomillado que contiene el delimitador (FR-008b)', async () => {
    const response = await importExample();
    const loadId = response.body.collectionLoadId;

    // La fila 1007 tiene `"México : Alfaomega ; Ra-Ma, 2006."` en el pie de imprenta.
    // Un reparto por carácter desplazaría las columnas siguientes.
    const row = await testDb
      .selectFrom('books')
      .select(['classification_raw', 'year'])
      .where('collection_load_id', '=', loadId)
      .where('source_barcode', '=', '1007')
      .executeTakeFirstOrThrow();

    expect(row.classification_raw).toBe('500 P111p 23');
    expect(row.year).toBe(2013);
  });

  it('atribuye la carga a la persona que la creó', async () => {
    const response = await importExample();

    const load = await testDb
      .selectFrom('collection_loads')
      .select('created_by')
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .executeTakeFirstOrThrow();

    expect(load.created_by).not.toBeNull();
  });
});
