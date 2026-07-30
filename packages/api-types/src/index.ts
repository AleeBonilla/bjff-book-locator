/**
 * Tipos compartidos del contrato REST.
 *
 * Fuente: specs/001-collection-import/contracts/rest-api.md
 *
 * Este paquete no tiene código en tiempo de ejecución: existe para que el frontend y
 * el backend no puedan desincronizarse sobre la forma de las respuestas.
 */

// --- Errores ---

/** Códigos de error que devuelve la API. */
export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'NO_FILE'
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_ROWS'
  | 'INVALID_ENCODING'
  | 'EMPTY_FILE'
  | 'MISSING_HEADER'
  | 'MISSING_REQUIRED_COLUMN'
  | 'LOAD_NOT_FOUND'
  | 'LOAD_IN_USE'
  | 'VALIDATION_FAILED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    /** Mensaje en español, apto para mostrarse a la persona usuaria (SC-010). */
    message: string;
    details?: Record<string, unknown>;
  };
}

// --- Autenticación ---

export type UserRole = 'ADMIN';

export interface Usuario {
  userId: number;
  username: string;
  fullName: string | null;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SessionResponse {
  user: Usuario;
}

// --- Cargas de colección ---

export type LoadStatus = 'PENDING' | 'DONE' | 'ERROR';

export type LoadErrorSeverity = 'REVIEW' | 'REJECTED';

export interface LoadCounters {
  rowsRead: number;
  rowsImported: number;
  rowsWithoutKey: number;
  rowsFlagged: number;
  rowsRejected: number;
}

export interface ResumenDeCarga {
  collectionLoadId: number;
  title: string;
  filename: string;
  status: LoadStatus;
  counters: LoadCounters;
  createdBy: { userId: number; username: string } | null;
  createdAt: string;
}

export interface Carga extends ResumenDeCarga {
  /** Motivo general del fallo cuando `status` es `ERROR`. */
  errorMessage: string | null;
}

export interface ProblemaDeCarga {
  collectionLoadErrorId: number;
  rowNumber: number;
  severity: LoadErrorSeverity;
  reason: string;
  /**
   * Código de clasificación original que provocó el problema (FR-038a). Sin él, el
   * motivo no permite entender qué hay que corregir. Es `null` cuando la fila no llegó
   * a importarse.
   */
  classificationRaw: string | null;
  /**
   * Contenido original de la fila, para diagnóstico. Puede contener datos de la
   * colección privada: solo se entrega con sesión activa (FR-044).
   */
  rawContent: string | null;
}

export interface Registro {
  bookId: number;
  sourceRowNumber: number;
  sourceBarcode: string;
  /** Código de clasificación tal como venía en el archivo (FR-016). */
  classificationRaw: string | null;
  /** Clave derivada. `null` cuando el código está ausente (FR-024). */
  comparableKey: string | null;
  isbn: string | null;
  title: string | null;
  author: string | null;
  copyLabel: string | null;
  year: number | null;
}

// --- Paginación ---

export interface Paginado<T> {
  items: T[];
  total: number;
}
