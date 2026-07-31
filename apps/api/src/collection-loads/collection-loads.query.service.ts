import { Inject, Injectable } from '@nestjs/common';
import type {
  Carga,
  Paginado,
  ProblemaDeCarga,
  Registro,
  ResumenDeCarga,
} from '@bjff/api-types';

import { ApiError } from '../common/api-error.js';
import { DATABASE, type Db } from '../database/database.module.js';
import type {
  BookRow,
  CollectionLoadErrorRow,
  CollectionLoadRow,
  LoadErrorSeverity,
} from '../database/schema.types.js';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export interface Page {
  limit: number;
  offset: number;
}

export function normalizePage(limit?: number, offset?: number): Page {
  return {
    limit: Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT),
    offset: Math.max(offset ?? 0, 0),
  };
}

/**
 * Consulta de cargas, problemas y registros.
 *
 * Todo lo que devuelve exige sesión activa: la guarda global lo garantiza (FR-042).
 * `rawContent` solo viaja dentro de estas respuestas administrativas (FR-044).
 */
@Injectable()
export class CollectionLoadsQueryService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  async list(page: Page): Promise<Paginado<ResumenDeCarga>> {
    const rows = await this.db
      .selectFrom('collection_loads')
      .leftJoin('users', 'users.user_id', 'collection_loads.created_by')
      .select([
        'collection_loads.collection_load_id',
        'collection_loads.title',
        'collection_loads.filename',
        'collection_loads.status',
        'collection_loads.rows_read',
        'collection_loads.rows_imported',
        'collection_loads.rows_without_key',
        'collection_loads.rows_flagged',
        'collection_loads.rows_rejected',
        'collection_loads.created_by',
        'collection_loads.created_at',
        'users.username as creator_username',
      ])
      // FR-041: distinguibles y ordenadas por fecha de creación.
      .orderBy('collection_loads.created_at', 'desc')
      .orderBy('collection_loads.collection_load_id', 'desc')
      .limit(page.limit)
      .offset(page.offset)
      .execute();

    const { count } = await this.db
      .selectFrom('collection_loads')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirstOrThrow();

    return {
      items: rows.map((row) =>
        toResumen(row as unknown as CollectionLoadRow, row.creator_username),
      ),
      total: Number(count),
    };
  }

  async detail(collectionLoadId: number): Promise<Carga> {
    const row = await this.db
      .selectFrom('collection_loads')
      .leftJoin('users', 'users.user_id', 'collection_loads.created_by')
      .selectAll('collection_loads')
      .select('users.username as creator_username')
      .where('collection_load_id', '=', collectionLoadId)
      .executeTakeFirst();

    if (!row) throw ApiError.loadNotFound();

    return {
      ...toResumen(row as unknown as CollectionLoadRow, row.creator_username),
      // El motivo general del fallo se deriva del estado: el esquema de esta versión
      // no tiene columna propia para él.
      errorMessage:
        row.status === 'ERROR' ? 'La importación no pudo completarse.' : null,
    };
  }

  async errors(
    collectionLoadId: number,
    page: Page,
    severity?: LoadErrorSeverity,
  ): Promise<Paginado<ProblemaDeCarga>> {
    await this.assertExists(collectionLoadId);

    // FR-038a: el código original acompaña al problema. `collection_load_errors` no
    // referencia `books`, pero comparten la carga y el número de fila.
    let query = this.db
      .selectFrom('collection_load_errors as e')
      .leftJoin('books as b', (join) =>
        join
          .onRef('b.collection_load_id', '=', 'e.collection_load_id')
          .onRef('b.source_row_number', '=', 'e.row_number'),
      )
      .selectAll('e')
      .select('b.classification_raw')
      .where('e.collection_load_id', '=', collectionLoadId);

    if (severity) query = query.where('e.severity', '=', severity);

    const rows = await query
      // FR-038: localizables por número de fila.
      .orderBy('e.row_number', 'asc')
      .limit(page.limit)
      .offset(page.offset)
      .execute();

    let countQuery = this.db
      .selectFrom('collection_load_errors')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('collection_load_id', '=', collectionLoadId);

    if (severity) countQuery = countQuery.where('severity', '=', severity);


    const { count } = await countQuery.executeTakeFirstOrThrow();

    return { items: rows.map(toProblema), total: Number(count) };
  }

  async books(
    collectionLoadId: number,
    page: Page,
    withoutKey = false,
  ): Promise<Paginado<Registro>> {
    await this.assertExists(collectionLoadId);

    let query = this.db
      .selectFrom('books')
      .selectAll()
      .where('collection_load_id', '=', collectionLoadId);

    if (withoutKey) query = query.where('comparable_key', 'is', null);

    const rows = await query
      .orderBy('source_row_number', 'asc')
      .limit(page.limit)
      .offset(page.offset)
      .execute();

    let countQuery = this.db
      .selectFrom('books')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('collection_load_id', '=', collectionLoadId);

    if (withoutKey) countQuery = countQuery.where('comparable_key', 'is', null);

    const { count } = await countQuery.executeTakeFirstOrThrow();

    return { items: rows.map(toRegistro), total: Number(count) };
  }

  private async assertExists(collectionLoadId: number): Promise<void> {
    const row = await this.db
      .selectFrom('collection_loads')
      .select('collection_load_id')
      .where('collection_load_id', '=', collectionLoadId)
      .executeTakeFirst();

    if (!row) throw ApiError.loadNotFound();
  }
}

export function toResumen(
  row: CollectionLoadRow,
  creatorUsername: string | null | undefined,
): ResumenDeCarga {
  return {
    collectionLoadId: row.collection_load_id,
    title: row.title,
    filename: row.filename,
    status: row.status,
    counters: {
      rowsRead: row.rows_read,
      rowsImported: row.rows_imported,
      rowsWithoutKey: row.rows_without_key,
      rowsFlagged: row.rows_flagged,
      rowsRejected: row.rows_rejected,
    },
    createdBy:
      row.created_by !== null && creatorUsername
        ? { userId: row.created_by, username: creatorUsername }
        : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function toProblema(
  row: CollectionLoadErrorRow & { classification_raw?: string | null },
): ProblemaDeCarga {
  return {
    collectionLoadErrorId: row.collection_load_error_id,
    rowNumber: row.row_number,
    severity: row.severity,
    reason: row.reason,
    classificationRaw: row.classification_raw ?? null,
    rawContent: row.raw_content,
  };
}

/**
 * Puntuación catalográfica final que el sistema de origen arrastra al final del
 * título: ` : ` separa el subtítulo, ` / ` la mención de responsabilidad y ` = ` el
 * título paralelo.
 *
 * Puede venir repetida —`… : /` y `… / :` aparecen en la colección—, así que el
 * patrón admite una secuencia y no un solo signo.
 *
 * El punto final NO se recorta: también cierra abreviaturas y su recorte no tiene una
 * sola lectura (FR-018 de 002-load-management).
 */
const TRAILING_ISBD_PUNCTUATION = /(?:\s*[:/=])+\s*$/;

/**
 * Título tal como debe mostrarse (FR-017, FR-019, FR-020).
 *
 * Es un recorte de presentación: `books.title` conserva el valor importado.
 */
export function displayTitle(title: string | null): string | null {
  if (title === null) return null;

  const cleaned = title.replace(TRAILING_ISBD_PUNCTUATION, '').trim();
  return cleaned === '' ? null : cleaned;
}

function toRegistro(row: BookRow): Registro {
  return {
    bookId: row.book_id,
    sourceRowNumber: row.source_row_number,
    sourceBarcode: row.source_barcode,
    classificationRaw: row.classification_raw,
    comparableKey: row.comparable_key,
    isbn: row.isbn,
    title: displayTitle(row.title),
    author: row.author,
    copyLabel: row.copy_label,
    year: row.year,
  };
}
