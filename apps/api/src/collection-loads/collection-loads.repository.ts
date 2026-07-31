import { Inject, Injectable } from '@nestjs/common';

import { ApiError } from '../common/api-error.js';
import { DATABASE, type Db } from '../database/database.module.js';
import type { Tx } from '../database/transaction.js';
import type {
  CollectionLoadRow,
  NewBook,
  NewCollectionLoadError,
  ProcessStatus,
} from '../database/schema.types.js';

/**
 * Persistencia de las cargas de colección.
 *
 * La inserción va por lotes: 10 000 filas de a una serían 10 000 viajes a la base y
 * no alcanzarían el objetivo de SC-006.
 */

/** Tamaño de lote de la inserción masiva. Decisión 2 de research.md. */
export const INSERT_BATCH_SIZE = 1000;

/** `foreign_key_violation` de PostgreSQL. */
const FOREIGN_KEY_VIOLATION = '23503';

export interface LoadCounterUpdate {
  rows_read: number;
  rows_imported: number;
  rows_without_key: number;
  rows_flagged: number;
  rows_rejected: number;
}

@Injectable()
export class CollectionLoadsRepository {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async createPending(
    title: string,
    filename: string,
    createdBy: number | null,
  ): Promise<CollectionLoadRow> {
    return this.db
      .insertInto('collection_loads')
      .values({ title, filename, status: 'PENDING', created_by: createdBy })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async finish(
    collectionLoadId: number,
    status: ProcessStatus,
    counters: LoadCounterUpdate,
  ): Promise<void> {
    await this.db
      .updateTable('collection_loads')
      .set({ status, ...counters })
      .where('collection_load_id', '=', collectionLoadId)
      .execute();
  }

  async insertBooks(tx: Tx, books: NewBook[]): Promise<void> {
    for (let start = 0; start < books.length; start += INSERT_BATCH_SIZE) {
      const batch = books.slice(start, start + INSERT_BATCH_SIZE);
      await tx.insertInto('books').values(batch).execute();
    }
  }

  async insertErrors(tx: Tx, errors: NewCollectionLoadError[]): Promise<void> {
    for (let start = 0; start < errors.length; start += INSERT_BATCH_SIZE) {
      const batch = errors.slice(start, start + INSERT_BATCH_SIZE);
      await tx.insertInto('collection_load_errors').values(batch).execute();
    }
  }

  /**
   * Elimina la carga (FR-001, FR-003).
   *
   * Los registros y los problemas se van con ella por las llaves foráneas en cascada
   * de `database/01_schema.sql`: es una sola operación y no puede dejar huérfanos.
   *
   * Una carga usada por una corrida de distribución no se elimina: esa llave está
   * definida como `RESTRICT` y el motor rechaza el borrado (FR-005).
   *
   * @returns cuántas cargas se eliminaron: `0` si no existía.
   */
  async remove(collectionLoadId: number): Promise<number> {
    try {
      const result = await this.db
        .deleteFrom('collection_loads')
        .where('collection_load_id', '=', collectionLoadId)
        .executeTakeFirst();

      return Number(result.numDeletedRows ?? 0);
    } catch (error) {
      // 23503: violación de llave foránea. Solo puede venir de una corrida de
      // distribución que use la carga, que el esquema protege con RESTRICT.
      if ((error as { code?: string }).code === FOREIGN_KEY_VIOLATION) {
        throw ApiError.loadInUse();
      }
      throw error;
    }
  }
}
