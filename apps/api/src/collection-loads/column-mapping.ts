import { ApiError } from '../common/api-error.js';

/**
 * Correspondencia entre las columnas del archivo y los campos del registro.
 *
 * Las columnas se reconocen por nombre y son independientes de su posición (FR-010).
 * Las desconocidas se ignoran sin rechazar el archivo (FR-012).
 *
 * La correspondencia está documentada en data-model.md.
 */

export const REQUIRED_COLUMNS = ['codBarras', 'Clasificacion'] as const;

const OPTIONAL_COLUMNS = {
  author: 'Autor',
  title: 'Titulo',
  isbn: 'isbn',
  year: 'Año',
  copyLabel: 'Z30_DESCRIPTION',
} as const;

export interface ColumnMapping {
  barcode: number;
  classification: number;
  author: number | null;
  title: number | null;
  isbn: number | null;
  year: number | null;
  copyLabel: number | null;
}

function findColumn(header: string[], name: string): number | null {
  const target = name.trim().toLowerCase();
  const index = header.findIndex((column) => column.trim().toLowerCase() === target);
  return index === -1 ? null : index;
}

/**
 * @throws {ApiError} `MISSING_REQUIRED_COLUMN` si falta una columna requerida
 * (FR-010, FR-013).
 */
export function buildColumnMapping(header: string[]): ColumnMapping {
  for (const column of REQUIRED_COLUMNS) {
    if (findColumn(header, column) === null) {
      throw ApiError.missingRequiredColumn(column);
    }
  }

  return {
    barcode: findColumn(header, 'codBarras')!,
    classification: findColumn(header, 'Clasificacion')!,
    author: findColumn(header, OPTIONAL_COLUMNS.author),
    title: findColumn(header, OPTIONAL_COLUMNS.title),
    isbn: findColumn(header, OPTIONAL_COLUMNS.isbn),
    year: findColumn(header, OPTIONAL_COLUMNS.year),
    copyLabel: findColumn(header, OPTIONAL_COLUMNS.copyLabel),
  };
}

export function valueAt(values: string[], index: number | null): string | null {
  if (index === null) return null;
  const value = values[index];
  if (value === undefined || value === '') return null;
  return value;
}

/** Límites de `books.year` en `database/01_schema.sql`. */
export const YEAR_MIN = 1400;
export const YEAR_MAX = 2200;

export interface ParsedYear {
  value: number | null;
  /** El valor no era `0` y tampoco un año admisible (FR-011b). */
  needsReview: boolean;
}

/**
 * Interpreta la columna de año.
 *
 * El sistema de origen usa `0` como marcador de ausencia: no es un dato inválido y no
 * marca la fila (FR-011a). Cualquier otro valor no numérico o fuera del intervalo sí
 * la marca (FR-011b).
 */
export function parseYear(raw: string | null): ParsedYear {
  if (raw === null || raw === '' || raw === '0') {
    return { value: null, needsReview: false };
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < YEAR_MIN || parsed > YEAR_MAX) {
    return { value: null, needsReview: true };
  }

  return { value: parsed, needsReview: false };
}
