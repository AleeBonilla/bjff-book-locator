import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

import { ApiError } from '../common/api-error.js';

/**
 * Lectura del archivo de colección.
 *
 * FR-008b prohíbe repartir las filas por el carácter delimitador: los campos
 * entrecomillados lo contienen y un reparto ingenuo desplazaría las columnas
 * posteriores. Se usa un lector CSV que respeta el entrecomillado.
 */

export interface CsvRow {
  /** Número de línea en el archivo. El encabezado es la línea 1 (FR-030). */
  rowNumber: number;
  values: string[];
  /** El número de campos no coincide con el del encabezado (FR-039). */
  fieldCountMismatch: boolean;
  /** Texto original de la fila, para diagnóstico. */
  raw: string;
}

export interface CsvReadResult {
  header: string[];
  rows: CsvRow[];
  /** Conteo declarado en el pie `TOTAL;n`, o `null` si no había pie (FR-034). */
  declaredTotal: number | null;
  /** Filas que aparecían después del pie de control (FR-035). */
  rowsAfterFooter: CsvRow[];
}

const FOOTER_MARKER = 'TOTAL';

@Injectable()
export class CsvReaderService {
  /**
   * Decodifica el archivo como UTF-8 y descarta el BOM.
   *
   * @throws {ApiError} `INVALID_ENCODING` si no es UTF-8 válido (FR-013).
   */
  decode(buffer: Buffer): string {
    let text: string;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      throw ApiError.invalidEncoding();
    }
    // FR-009: U+FEFF es el BOM ya decodificado.
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }

  /**
   * Convierte el texto en filas. Tolera CRLF y LF (FR-008a) y respeta el
   * entrecomillado (FR-008b).
   *
   * @throws {ApiError} `EMPTY_FILE` o `MISSING_HEADER` (FR-013).
   */
  read(text: string): CsvReadResult {
    if (text.trim() === '') throw ApiError.emptyFile();

    const parsed = parse(text, {
      delimiter: ';',
      quote: '"',
      // Una fila con un número de campos distinto debe llegar al código para marcarse
      // REJECTED, no abortar la lectura (FR-039).
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: false,
      info: true,
      raw: true,
    }) as Array<{ record: string[]; info: { lines: number }; raw: string }>;

    if (parsed.length === 0) throw ApiError.missingHeader();

    const headerEntry = parsed[0]!;
    const header = headerEntry.record.map((value) => value.trim());
    if (header.length === 0 || header.every((value) => value === '')) {
      throw ApiError.missingHeader();
    }

    const rows: CsvRow[] = [];
    const rowsAfterFooter: CsvRow[] = [];
    let declaredTotal: number | null = null;
    let footerSeen = false;

    for (const entry of parsed.slice(1)) {
      // FR-014: los espacios de relleno se recortan antes de interpretar.
      const values = entry.record.map((value) => value.trim());

      // FR-033: la fila vacía se ignora y no cuenta como fila de datos ni problema.
      if (values.every((value) => value === '')) continue;

      const row: CsvRow = {
        rowNumber: entry.info.lines,
        values,
        fieldCountMismatch: values.length !== header.length,
        raw: entry.raw,
      };

      if (!footerSeen && values[0]?.toUpperCase() === FOOTER_MARKER) {
        footerSeen = true;
        const declared = Number.parseInt(values[1] ?? '', 10);
        declaredTotal = Number.isFinite(declared) ? declared : null;
        continue;
      }

      // FR-035: lo que aparece después del pie se registra como problema.
      if (footerSeen) rowsAfterFooter.push(row);
      else rows.push(row);
    }

    return { header, rows, declaredTotal, rowsAfterFooter };
  }
}
