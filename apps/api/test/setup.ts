/**
 * Arnés de las pruebas de integración.
 *
 * Las pruebas corren contra PostgreSQL real: el orden con `COLLATE "C"`, las
 * restricciones del esquema y la atomicidad son justamente lo que hay que verificar y
 * no se pueden simular.
 *
 * El aislamiento se logra vaciando las tablas de la funcionalidad antes de cada caso.
 * Se descartó revertir una transacción por caso porque las pruebas atraviesan HTTP y
 * la aplicación usa su propia conexión: no podría compartir la transacción del test.
 *
 * Por eso corren contra **su propia base**, `bjff_test`, separada de la de desarrollo:
 * de lo contrario cada corrida borraría las cargas y la cuenta administrativa.
 *
 * Requiere la base levantada: `npm run db:up`.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { sql } from 'kysely';
import { afterAll, beforeEach } from 'vitest';

import { createDatabase } from '../src/database/database.module.js';

// El `.env` del repositorio también define TEST_DATABASE_URL.
for (const candidate of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
]) {
  if (existsSync(candidate)) {
    try {
      process.loadEnvFile(candidate);
    } catch {
      // Un `.env` ilegible no debe impedir ejecutar las pruebas.
    }
    break;
  }
}

const DEFAULT_TEST_DATABASE_URL = 'postgres://bjff:cambiar@localhost:5432/bjff_test';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

if (!/_test(\?|$)/.test(new URL(TEST_DATABASE_URL).pathname + '')) {
  throw new Error(
    `TEST_DATABASE_URL debe apuntar a una base cuyo nombre termine en "_test". ` +
      `Recibido: ${new URL(TEST_DATABASE_URL).pathname}. ` +
      'Es la salvaguarda que impide vaciar la base de desarrollo.',
  );
}

// La aplicación bajo prueba se conecta a la misma base que el arnés.
process.env.DATABASE_URL = TEST_DATABASE_URL;

export const testDb = createDatabase(TEST_DATABASE_URL);

export async function truncateAll(): Promise<void> {
  await sql`
    TRUNCATE
      book_placements,
      distribution_ranges,
      distribution_anchors,
      distribution_position_inputs,
      distribution_runs,
      location_distribution_settings,
      locations,
      structure_template_nodes,
      structure_templates,
      schemes,
      books,
      collection_load_errors,
      collection_loads,
      users
    RESTART IDENTITY CASCADE
  `.execute(testDb);
}

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await testDb.destroy();
});
