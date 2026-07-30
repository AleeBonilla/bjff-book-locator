import { HttpException } from '@nestjs/common';
import type { ApiErrorCode } from '@bjff/api-types';

/**
 * Error de la API con la forma del contrato.
 *
 * Fuente: specs/001-collection-import/contracts/rest-api.md
 */
export class ApiError extends HttpException {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, details }, status);
  }

  static unauthenticated(): ApiError {
    return new ApiError('UNAUTHENTICATED', 'Se requiere una sesión activa.', 401);
  }

  /**
   * Respuesta única para credenciales inválidas y cuenta deshabilitada (FR-002).
   * No revela si la cuenta existe ni cuál de los dos datos falló.
   */
  static invalidCredentials(): ApiError {
    return new ApiError('INVALID_CREDENTIALS', 'Credenciales inválidas.', 401);
  }

  static noFile(): ApiError {
    return new ApiError('NO_FILE', 'No se recibió ningún archivo.', 400);
  }

  static fileTooLarge(limitBytes: number, actualBytes: number): ApiError {
    return new ApiError(
      'FILE_TOO_LARGE',
      'El archivo supera el tamaño máximo admitido.',
      413,
      { limitBytes, actualBytes },
    );
  }

  static tooManyRows(limitRows: number): ApiError {
    return new ApiError(
      'TOO_MANY_ROWS',
      'El archivo supera el número máximo de filas admitido.',
      422,
      { limitRows },
    );
  }

  static invalidEncoding(): ApiError {
    return new ApiError(
      'INVALID_ENCODING',
      'El archivo no puede leerse como UTF-8.',
      422,
    );
  }

  static emptyFile(): ApiError {
    return new ApiError('EMPTY_FILE', 'El archivo está vacío.', 422);
  }

  static missingHeader(): ApiError {
    return new ApiError(
      'MISSING_HEADER',
      'El archivo no tiene una fila de encabezado.',
      422,
    );
  }

  static missingRequiredColumn(column: string): ApiError {
    return new ApiError(
      'MISSING_REQUIRED_COLUMN',
      `Falta la columna requerida ${column}.`,
      422,
      { column },
    );
  }

  static loadNotFound(): ApiError {
    return new ApiError('LOAD_NOT_FOUND', 'La carga no existe.', 404);
  }

  /** La carga sostiene una corrida de distribución y no puede eliminarse (FR-005). */
  static loadInUse(): ApiError {
    return new ApiError(
      'LOAD_IN_USE',
      'La carga está en uso por una distribución y no puede eliminarse.',
      409,
    );
  }
}
