import type { Transaction } from 'kysely';

import type { Db } from './database.module.js';
import type { Database } from './schema.types.js';

export type Tx = Transaction<Database>;

/**
 * Ejecuta `work` dentro de una transacción.
 *
 * Es el mecanismo que sostiene FR-028: una importación fallida revierte por completo
 * los registros y nunca deja una carga parcialmente utilizable.
 *
 * En pruebas se sustituye por una implementación que reutiliza la transacción del
 * caso, de modo que el aislamiento no dependa de recrear el esquema.
 */
export interface TransactionRunner {
  run<T>(work: (tx: Tx) => Promise<T>): Promise<T>;
}

export class KyselyTransactionRunner implements TransactionRunner {
  constructor(private readonly db: Db) {}

  run<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction().execute(work);
  }
}

export const TRANSACTION_RUNNER = Symbol('TRANSACTION_RUNNER');
