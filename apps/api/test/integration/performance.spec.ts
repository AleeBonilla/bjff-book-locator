import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, importFile, login, seedAdmin } from '../helpers.js';

/**
 * T071 — Objetivo de SC-006: una importación de 10 000 filas debe completarse en
 * menos de 30 segundos. Es la medida que sostiene la decisión de procesar de forma
 * síncrona (FR-026a).
 *
 * No corre en la suite habitual porque genera y procesa un archivo grande. Para
 * ejecutarla:
 *
 *   PERF=1 npx vitest run --project api test/integration/performance.spec.ts
 */

const SC006_LIMIT_MS = 30_000;
const ROWS = 10_000;

/** Archivo sintético. No reproduce dato alguno de la colección real. */
function syntheticCsv(rows: number): Buffer {
  const header = 'codBarras;NumeroOrden;Autor;Clasificacion;isbn;Titulo;Año';
  const lines: string[] = [header];

  for (let index = 0; index < rows; index += 1) {
    const ddc = (100 + (index % 900)).toString();
    const fraction = (index % 1000).toString().padStart(3, '0');
    const cutter = `A${(index % 900) + 100}a`;
    lines.push(
      `${20000 + index};${index};Autora, Prueba;${ddc}.${fraction} ${cutter} 23;` +
        `9789968319843;Obra sintética ${index};2013`,
    );
  }

  lines.push('', `TOTAL;${rows}`);
  return Buffer.from(lines.join('\n'), 'utf8');
}

describe.skipIf(!process.env.PERF)('rendimiento de la importación (SC-006)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it(`importa ${ROWS} filas en menos de ${SC006_LIMIT_MS / 1000} segundos`, async () => {
    await seedAdmin();
    const cookie = await login(app);
    const csv = syntheticCsv(ROWS);

    const startedAt = Date.now();
    const response = await importFile(app, cookie, csv, 'sintetico.csv');
    const elapsedMs = Date.now() - startedAt;

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('DONE');
    expect(response.body.counters.rowsImported).toBe(ROWS);

    process.stdout.write(
      `\nSC-006: ${ROWS} filas importadas en ${elapsedMs} ms ` +
        `(límite ${SC006_LIMIT_MS} ms)\n`,
    );

    expect(elapsedMs).toBeLessThan(SC006_LIMIT_MS);
  }, 120_000);
});
