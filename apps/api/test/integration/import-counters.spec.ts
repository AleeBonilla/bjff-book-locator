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

/**
 * T046 — SC-002 y SC-003: los contadores exactos del archivo de ejemplo y su
 * estabilidad entre ejecuciones.
 */
describe('contadores del archivo de ejemplo (SC-002)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('produce exactamente los contadores especificados', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const response = await importFile(app, cookie, exampleCsv());

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DONE');
    expect(response.body.counters).toEqual(EXAMPLE_EXPECTED);
  });

  it('deriva la misma clave para códigos que solo difieren en la edición (SC-005)', async () => {
    await seedAdmin();
    const cookie = await login(app);
    const response = await importFile(app, cookie, exampleCsv());
    const loadId = response.body.collectionLoadId;

    const rows = await testDb
      .selectFrom('books')
      .select(['source_barcode', 'comparable_key'])
      .where('collection_load_id', '=', loadId)
      .where('source_barcode', 'in', ['1020', '1021'])
      .execute();

    expect(rows).toHaveLength(2);
    expect(rows[0]!.comparable_key).toBe(rows[1]!.comparable_key);
  });

  it('no marca el año ausente ni los prefijos Cu y CU (FR-011a, FR-020)', async () => {
    await seedAdmin();
    const cookie = await login(app);
    const response = await importFile(app, cookie, exampleCsv());
    const loadId = response.body.collectionLoadId;

    const flagged = await testDb
      .selectFrom('collection_load_errors')
      .innerJoin('books', (join) =>
        join
          .onRef('books.source_row_number', '=', 'collection_load_errors.row_number')
          .onRef(
            'books.collection_load_id',
            '=',
            'collection_load_errors.collection_load_id',
          ),
      )
      .select('books.source_barcode')
      .where('collection_load_errors.collection_load_id', '=', loadId)
      .where('collection_load_errors.severity', '=', 'REVIEW')
      .execute();

    const flaggedBarcodes = flagged.map((row) => row.source_barcode);

    // 1038: año 0. 1041 y 1042: prefijos Cu y CU. 1004/1005/1006: agrupamiento y
    // coma decimal, ahora normalizados en silencio (FR-018).
    expect(flaggedBarcodes).not.toContain('1038');
    expect(flaggedBarcodes).not.toContain('1041');
    expect(flaggedBarcodes).not.toContain('1042');
    expect(flaggedBarcodes).not.toContain('1004');
    expect(flaggedBarcodes).not.toContain('1005');
    expect(flaggedBarcodes).not.toContain('1006');
    expect(flaggedBarcodes).not.toContain('1023');
  });

  it('registra el año 0 como ausencia sin marcar la fila (FR-011a)', async () => {
    await seedAdmin();
    const cookie = await login(app);
    const response = await importFile(app, cookie, exampleCsv());

    const row = await testDb
      .selectFrom('books')
      .select('year')
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .where('source_barcode', '=', '1038')
      .executeTakeFirstOrThrow();

    expect(row.year).toBeNull();
  });

  it('ordena las claves con colación binaria como exige el diseño (SC-004)', async () => {
    await seedAdmin();
    const cookie = await login(app);
    const response = await importFile(app, cookie, exampleCsv());

    const rows = await testDb
      .selectFrom('books')
      .select(['source_barcode', 'comparable_key'])
      .where('collection_load_id', '=', response.body.collectionLoadId)
      .where('comparable_key', 'is not', null)
      .orderBy('comparable_key', 'asc')
      .execute();

    const position = (barcode: string): number =>
      rows.findIndex((row) => row.source_barcode === barcode);

    // 004.0151 antes que 004.1
    expect(position('1002')).toBeLessThan(position('1003'));
    // 863 S248m antes que 863 S25m
    expect(position('1025')).toBeLessThan(position('1026'));
    // Sin prefijo antes que con prefijo
    expect(position('1024')).toBeLessThan(position('1028'));
    // CR antes que M
    expect(position('1028')).toBeLessThan(position('1030'));
  });

  it('produce contadores y claves idénticos al repetir la importación (SC-003)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const first = await importFile(app, cookie, exampleCsv());
    const second = await importFile(app, cookie, exampleCsv());

    expect(second.body.counters).toEqual(first.body.counters);

    const keysOf = async (loadId: number): Promise<Array<string | null>> => {
      const rows = await testDb
        .selectFrom('books')
        .select('comparable_key')
        .where('collection_load_id', '=', loadId)
        .orderBy('source_row_number', 'asc')
        .execute();
      return rows.map((row) => row.comparable_key);
    };

    expect(await keysOf(second.body.collectionLoadId)).toEqual(
      await keysOf(first.body.collectionLoadId),
    );
  });
});
