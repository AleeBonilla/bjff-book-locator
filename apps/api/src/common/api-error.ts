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

  static invalidSearchInput(): ApiError {
    return new ApiError(
      'VALIDATION_FAILED',
      'El código no tiene un formato de clasificación utilizable.',
      422,
    );
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

  static notFound(
    code:
      | 'TEMPLATE_NOT_FOUND'
      | 'TEMPLATE_NODE_NOT_FOUND'
      | 'SCHEME_NOT_FOUND'
      | 'LOCATION_NOT_FOUND'
      | 'DISTRIBUTION_RUN_NOT_FOUND'
      | 'DISTRIBUTION_RANGE_NOT_FOUND',
    message: string,
  ): ApiError {
    return new ApiError(code, message, 404);
  }

  static conflict(
    code:
      | 'TEMPLATE_NOT_EDITABLE'
      | 'SCHEME_NOT_EDITABLE'
      | 'INVALID_STATE_TRANSITION'
      | 'TEMPLATE_NAME_CONFLICT'
      | 'SCHEME_NAME_CONFLICT'
      | 'SIBLING_NAME_CONFLICT'
      | 'MAP_ELEMENT_CONFLICT'
      | 'SUBTREE_CONFIRMATION_REQUIRED'
      | 'RUN_BUSY'
      | 'RUN_VERSION_CONFLICT'
      | 'RUN_IMMUTABLE'
      | 'INVALID_RUN_STATE'
      | 'UNASSIGNED_CONFIRMATION_REQUIRED',
    message: string,
    details?: Record<string, unknown>,
  ): ApiError {
    return new ApiError(code, message, 409, details);
  }

  static invalid(
    code:
      | 'INVALID_TEMPLATE_TREE'
      | 'INVALID_SCHEME_TREE'
      | 'INVALID_PARENT'
      | 'TREE_CYCLE'
      | 'ORDER_MISMATCH'
      | 'INVALID_DISTRIBUTION_SETTINGS'
      | 'SCHEME_LINEAGE_CYCLE'
      | 'INVALID_RUN_LINEAGE'
      | 'INVALID_STRATEGY_INPUTS'
      | 'INVALID_EFFECTIVE_CONFIGURATION'
      | 'INVALID_ANCHORS'
      | 'INVALID_MANUAL_RANGES'
      | 'COMPARISON_BASE_REQUIRED',
    message: string,
    details?: Record<string, unknown>,
  ): ApiError {
    return new ApiError(code, message, 422, details);
  }
}

interface PostgresError {
  code?: string;
  constraint?: string;
}

/** Convierte restricciones conocidas en errores estables del contrato. */
export function translateDatabaseError(error: unknown): ApiError | null {
  const pg = error as PostgresError;
  if (pg.code === '23503') {
    return ApiError.invalid('INVALID_PARENT', 'La relación padre-hija no es válida.');
  }

  if (pg.code !== '23505') return null;

  switch (pg.constraint) {
    case 'structure_templates_name_key':
      return ApiError.conflict(
        'TEMPLATE_NAME_CONFLICT',
        'Ya existe una plantilla con ese nombre.',
      );
    case 'schemes_name_key':
      return ApiError.conflict(
        'SCHEME_NAME_CONFLICT',
        'Ya existe un scheme con ese nombre.',
      );
    case 'uq_template_nodes_sibling_name':
    case 'uq_locations_sibling_name':
    case 'uq_locations_root_name':
      return ApiError.conflict(
        'SIBLING_NAME_CONFLICT',
        'Ya existe un elemento con ese nombre en el mismo nivel.',
      );
    case 'uq_locations_map_element':
      return ApiError.conflict(
        'MAP_ELEMENT_CONFLICT',
        'El elemento de mapa ya está vinculado dentro del scheme.',
      );
    case 'uq_template_nodes_sibling_order':
    case 'uq_template_nodes_one_root':
    case 'uq_locations_sibling_order':
    case 'uq_locations_root_order':
      return ApiError.invalid('ORDER_MISMATCH', 'El orden indicado no es válido.');
    default:
      return null;
  }
}
