import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { ApiErrorBody, ApiErrorCode } from '@bjff/api-types';
import type { Response } from 'express';

import { ApiError } from './api-error.js';
import { logger } from './logger.js';

/**
 * Traduce cualquier excepción a la envoltura única del contrato:
 * `{ error: { code, message, details } }`.
 *
 * Un error inesperado nunca filtra su mensaje interno hacia el cliente: se registra
 * del lado del servidor y se responde con un texto genérico.
 */
@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof ApiError) {
      response.status(exception.getStatus()).json(this.envelope(exception));
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : ((body as { message?: string | string[] }).message ?? exception.message);

      response.status(status).json({
        error: {
          code: status === 401 ? 'UNAUTHENTICATED' : 'VALIDATION_FAILED',
          message: Array.isArray(message) ? message.join('. ') : message,
        },
      } satisfies ApiErrorBody);
      return;
    }

    logger.error('unhandled_exception', {
      message: exception instanceof Error ? exception.message : 'desconocido',
    });

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR' satisfies ApiErrorCode,
        message: 'Ocurrió un error inesperado.',
      },
    } satisfies ApiErrorBody);
  }

  private envelope(error: ApiError): ApiErrorBody {
    return {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }
}
