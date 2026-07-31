import { Inject, Injectable } from '@nestjs/common';
import { REVIEW_REASON_TEXT, deriveClassification } from '@bjff/classification';

import { logger } from '../common/logger.js';
import { DATABASE, type Db } from '../database/database.module.js';
import type { Tx } from '../database/transaction.js';
import type {
  CollectionLoadRow,
  NewBook,
  NewCollectionLoadError,
} from '../database/schema.types.js';
import { parseYear, valueAt } from './column-mapping.js';
import {
  CollectionLoadsRepository,
  type LoadCounterUpdate,
} from './collection-loads.repository.js';
import type { CsvRow } from './csv-reader.service.js';
import { FileValidationService, type ValidatedFile } from './file-validation.service.js';

/**
 * Importación de una colección.
 *
 * Es síncrona (FR-026a): la persona administradora recibe el estado final y los
 * contadores en la misma acción. Y es atómica (FR-028): o la carga queda en `DONE`
 * con todos sus registros, o no queda ninguno disponible.
 */

/** Fallo que cierra la carga en `ERROR` sin dejar registros (FR-028, FR-032). */
export class ImportFailure extends Error {}

const YEAR_REVIEW_TEXT = 'Año fuera del intervalo admitido.';
const AFTER_FOOTER_TEXT = 'Fila posterior al pie de control.';
const FIELD_COUNT_TEXT = 'El número de campos no coincide con el encabezado.';
const MISSING_BARCODE_TEXT = 'Falta el código de barras.';

@Injectable()
export class ImportService {
  constructor(
    private readonly validation: FileValidationService,
    private readonly repository: CollectionLoadsRepository,
    @Inject(DATABASE) private readonly db: Db,
  ) {}

  async import(
    buffer: Buffer,
    filename: string,
    title: string,
    userId: number | null,
  ): Promise<CollectionLoadRow> {
    // Fase 1: el contrato del archivo se valida antes de crear nada. Un archivo
    // incompatible responde 4xx y no ensucia el historial (FR-013, FR-013a).
    const validated = this.validation.validate(buffer);

    // Fase 2: la carga existe a partir de aquí y conservará su desenlace (FR-026b).
    const load = await this.repository.createPending(title, filename, userId);

    logger.info('import_started', {
      collectionLoadId: load.collection_load_id,
      rowsToProcess: validated.read.rows.length,
    });

    try {
      const counters = await this.db
        .transaction()
        .execute((tx) => this.process(tx, load.collection_load_id, validated));

      await this.repository.finish(load.collection_load_id, 'DONE', counters);

      logger.info('import_finished', {
        collectionLoadId: load.collection_load_id,
        status: 'DONE',
        ...counters,
      });

      return { ...load, status: 'DONE', ...counters };
    } catch (error) {
      const expected = error instanceof ImportFailure;

      // La transacción ya revirtió los registros: la carga queda documentada en
      // ERROR y sin nada utilizable (FR-028, FR-028a).
      const counters = emptyCounters(totalFileRows(validated));
      await this.repository.finish(load.collection_load_id, 'ERROR', counters);

      logger.error('import_finished', {
        collectionLoadId: load.collection_load_id,
        status: 'ERROR',
        reason: expected ? 'validacion' : 'inesperado',
        message: expected ? (error as ImportFailure).message : undefined,
      });

      if (!expected) {
        logger.error('import_unexpected_error', {
          collectionLoadId: load.collection_load_id,
          message: error instanceof Error ? error.message : 'desconocido',
        });
      }

      return { ...load, status: 'ERROR', ...counters };
    }
  }

  /** Deriva y persiste los registros. Todo ocurre dentro de una transacción. */
  private async process(
    tx: Tx,
    collectionLoadId: number,
    validated: ValidatedFile,
  ): Promise<LoadCounterUpdate> {
    const { read, mapping } = validated;

    // FR-032: el conteo declarado en el pie debe coincidir con las filas leídas. Una
    // discrepancia sugiere un archivo truncado y cierra la carga en ERROR.
    if (read.declaredTotal !== null && read.declaredTotal !== read.rows.length) {
      throw new ImportFailure(
        `El pie declara ${read.declaredTotal} filas y se leyeron ${read.rows.length}.`,
      );
    }

    const books: NewBook[] = [];
    const problems: NewCollectionLoadError[] = [];

    let rowsImported = 0;
    let rowsWithoutKey = 0;
    let rowsFlagged = 0;
    let rowsRejected = 0;

    const reject = (row: CsvRow, reason: string): void => {
      rowsRejected += 1;
      problems.push({
        collection_load_id: collectionLoadId,
        row_number: row.rowNumber,
        severity: 'REJECTED',
        reason,
        raw_content: row.raw,
      });
    };

    for (const row of read.rows) {
      // FR-039: solo la fila ilegible se rechaza; el resto del archivo continúa.
      if (row.fieldCountMismatch) {
        reject(row, FIELD_COUNT_TEXT);
        continue;
      }

      const barcode = valueAt(row.values, mapping.barcode);
      if (barcode === null) {
        reject(row, MISSING_BARCODE_TEXT);
        continue;
      }

      const classificationRaw = valueAt(row.values, mapping.classification);
      const derived = deriveClassification(classificationRaw);
      const year = parseYear(valueAt(row.values, mapping.year));

      const reasons = derived.reviewReasons.map((code) => REVIEW_REASON_TEXT[code]);
      if (year.needsReview) reasons.push(YEAR_REVIEW_TEXT);

      books.push({
        collection_load_id: collectionLoadId,
        source_row_number: row.rowNumber,
        source_barcode: barcode,
        classification_raw: classificationRaw,
        comparable_key: derived.comparableKey,
        isbn: valueAt(row.values, mapping.isbn),
        title: valueAt(row.values, mapping.title),
        author: valueAt(row.values, mapping.author),
        copy_label: valueAt(row.values, mapping.copyLabel),
        year: year.value,
      });

      rowsImported += 1;
      if (derived.comparableKey === null) rowsWithoutKey += 1;

      if (reasons.length > 0) {
        rowsFlagged += 1;
        problems.push({
          collection_load_id: collectionLoadId,
          row_number: row.rowNumber,
          severity: 'REVIEW',
          reason: reasons.join(' '),
          raw_content: row.raw,
        });
      }
    }

    // FR-035: lo que aparece después del pie se registra y no se incorpora.
    for (const row of read.rowsAfterFooter) {
      reject(row, AFTER_FOOTER_TEXT);
    }

    await this.repository.insertBooks(tx, books);
    await this.repository.insertErrors(tx, problems);

    const counters: LoadCounterUpdate = {
      rows_read: totalFileRows(validated),
      rows_imported: rowsImported,
      rows_without_key: rowsWithoutKey,
      rows_flagged: rowsFlagged,
      rows_rejected: rowsRejected,
    };

    // FR-037: la invariante se comprueba antes de cerrar la carga en DONE.
    if (counters.rows_imported + counters.rows_rejected !== counters.rows_read) {
      throw new ImportFailure(
        'Los contadores no cuadran con las filas leídas: la carga no se cierra.',
      );
    }

    return counters;
  }
}

export function totalFileRows(validated: ValidatedFile): number {
  return validated.read.rows.length + validated.read.rowsAfterFooter.length;
}

export function emptyCounters(rowsRead: number): LoadCounterUpdate {
  return {
    rows_read: rowsRead,
    rows_imported: 0,
    rows_without_key: 0,
    rows_flagged: 0,
    rows_rejected: 0,
  };
}
