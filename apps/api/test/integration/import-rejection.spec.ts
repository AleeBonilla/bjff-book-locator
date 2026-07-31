import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, exampleCsv, importFile, login, seedAdmin } from '../helpers.js';
import { testDb } from '../setup.js';

/**
 * T047 — Rechazo del archivo antes de crear la carga (FR-013, FR-013a).
 *
 * Ninguno de estos casos debe dejar rastro en el historial de cargas.
 */
describe('rechazo del archivo', () => {
  let app: INestApplication;
  let cookie: string;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  async function ready(): Promise<string> {
    await seedAdmin();
    cookie = await login(app);
    return cookie;
  }

  async function loadCount(): Promise<number> {
    const rows = await testDb.selectFrom('collection_loads').select('status').execute();
    return rows.length;
  }

  it('rechaza la petición sin archivo con NO_FILE', async () => {
    await ready();
    const response = await request(app.getHttpServer())
      .post('/api/collection-loads')
      .set('Cookie', cookie)
      .expect(400);

    expect(response.body.error.code).toBe('NO_FILE');
    expect(await loadCount()).toBe(0);
  });

  it('rechaza un archivo vacío con EMPTY_FILE', async () => {
    await ready();
    const response = await importFile(app, cookie, Buffer.from('', 'utf8'));

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('NO_FILE');
    expect(await loadCount()).toBe(0);
  });

  it('rechaza un archivo con solo espacios con EMPTY_FILE', async () => {
    await ready();
    const response = await importFile(app, cookie, Buffer.from('   \n  ', 'utf8'));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('EMPTY_FILE');
    expect(await loadCount()).toBe(0);
  });

  it('rechaza un archivo que no es UTF-8 con INVALID_ENCODING', async () => {
    await ready();
    // Secuencia de continuación inválida en UTF-8.
    const invalid = Buffer.from([0x63, 0x6f, 0x64, 0xff, 0xfe, 0x3b, 0x0a]);
    const response = await importFile(app, cookie, invalid);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('INVALID_ENCODING');
    expect(await loadCount()).toBe(0);
  });

  it('rechaza un archivo sin la columna Clasificacion (FR-010)', async () => {
    await ready();
    const csv = ['codBarras;Titulo', '1001;Obra de prueba', '', 'TOTAL;1'].join('\n');
    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('MISSING_REQUIRED_COLUMN');
    expect(response.body.error.details.column).toBe('Clasificacion');
    expect(await loadCount()).toBe(0);
  });

  it('rechaza un archivo sin la columna codBarras (FR-010)', async () => {
    await ready();
    const csv = ['Clasificacion;Titulo', '658 A111a;Obra', '', 'TOTAL;1'].join('\n');
    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.status).toBe(422);
    expect(response.body.error.details.column).toBe('codBarras');
    expect(await loadCount()).toBe(0);
  });

  it('acepta las columnas en distinto orden y con columnas desconocidas (FR-010, FR-012)', async () => {
    await ready();
    const csv = [
      'Otra;Clasificacion;Desconocida;codBarras',
      'x;658 A111a 23;y;1001',
      '',
      'TOTAL;1',
    ].join('\n');

    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DONE');
    expect(response.body.counters.rowsImported).toBe(1);
  });

  it('procesa un archivo con solo encabezado como carga de cero registros', async () => {
    await ready();
    const csv = 'codBarras;Clasificacion\n';
    const response = await importFile(app, cookie, Buffer.from(csv, 'utf8'));

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DONE');
    expect(response.body.counters.rowsRead).toBe(0);
    expect(response.body.counters.rowsImported).toBe(0);
  });

  it('rechaza un archivo por encima del límite de tamaño (FR-013a)', async () => {
    await ready();
    process.env.IMPORT_MAX_FILE_BYTES = '128';

    try {
      const local = await createApp();
      const localCookie = await (async () => {
        const res = await request(local.getHttpServer())
          .post('/api/auth/login')
          .send({ username: 'admin_prueba', password: 'contrasena-de-prueba-123' })
          .expect(200);
        return (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
      })();

      const response = await importFile(local, localCookie, exampleCsv());

      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe('FILE_TOO_LARGE');
      expect(response.body.error.details.limitBytes).toBe(128);
      expect(await loadCount()).toBe(0);

      await local.close();
    } finally {
      delete process.env.IMPORT_MAX_FILE_BYTES;
    }
  });

  it('rechaza un archivo por encima del límite de filas (FR-013a)', async () => {
    await ready();
    process.env.IMPORT_MAX_ROWS = '5';

    try {
      const local = await createApp();
      const res = await request(local.getHttpServer())
        .post('/api/auth/login')
        .send({ username: 'admin_prueba', password: 'contrasena-de-prueba-123' })
        .expect(200);
      const localCookie = (res.headers['set-cookie'] as unknown as string[])[0]!
        .split(';')[0]!;

      const response = await importFile(local, localCookie, exampleCsv());

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('TOO_MANY_ROWS');
      expect(await loadCount()).toBe(0);

      await local.close();
    } finally {
      delete process.env.IMPORT_MAX_ROWS;
    }
  });
});
