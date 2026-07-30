import type { Generated, Insertable, Selectable } from 'kysely';

/**
 * Tipos de las tablas que usa esta funcionalidad.
 *
 * La fuente de verdad de la estructura es `database/01_schema.sql`. Este archivo la
 * describe para Kysely; no la define. Cualquier cambio en el esquema debe llegar
 * primero al SQL y a `docs/db.md` (principios VII y X de la constitución).
 *
 * Solo se declaran las cuatro tablas de esta funcionalidad, según `data-model.md`.
 */

export type ProcessStatus = 'PENDING' | 'DONE' | 'ERROR';
export type LoadErrorSeverity = 'REVIEW' | 'REJECTED';
export type UserRole = 'ADMIN';

export interface UsersTable {
  user_id: Generated<number>;
  username: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: Generated<UserRole>;
  enabled: Generated<boolean>;
  last_login_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CollectionLoadsTable {
  collection_load_id: Generated<number>;
  title: string;
  filename: string;
  status: Generated<ProcessStatus>;
  rows_read: Generated<number>;
  rows_imported: Generated<number>;
  rows_without_key: Generated<number>;
  rows_flagged: Generated<number>;
  rows_rejected: Generated<number>;
  created_by: number | null;
  created_at: Generated<Date>;
}

export interface CollectionLoadErrorsTable {
  collection_load_error_id: Generated<number>;
  collection_load_id: number;
  row_number: number;
  severity: Generated<LoadErrorSeverity>;
  reason: string;
  raw_content: string | null;
}

export interface BooksTable {
  book_id: Generated<number>;
  collection_load_id: number;
  source_row_number: number;
  source_barcode: string;
  classification_raw: string | null;
  /** Columna `COLLATE "C"`: el orden no depende de la configuración regional. */
  comparable_key: string | null;
  isbn: string | null;
  title: string | null;
  author: string | null;
  copy_label: string | null;
  year: number | null;
  created_at: Generated<Date>;
}

export interface Database {
  users: UsersTable;
  collection_loads: CollectionLoadsTable;
  collection_load_errors: CollectionLoadErrorsTable;
  books: BooksTable;
}

export type UserRow = Selectable<UsersTable>;
export type CollectionLoadRow = Selectable<CollectionLoadsTable>;
export type CollectionLoadErrorRow = Selectable<CollectionLoadErrorsTable>;
export type BookRow = Selectable<BooksTable>;

export type NewBook = Insertable<BooksTable>;
export type NewCollectionLoadError = Insertable<CollectionLoadErrorsTable>;
