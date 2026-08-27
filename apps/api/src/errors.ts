import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: unknown[] = [],
  ) {
    super(message);
  }
}

interface DatabaseError extends Error {
  code?: string;
  constraint?: string;
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'INVALID_REQUEST',
        message: 'La solicitud no tiene el formato esperado.',
        details: error.issues,
      },
    });
    return;
  }

  if ((error as { name?: string }).name === 'MulterError') {
    response.status(400).json({
      error: {
        code: 'INVALID_UPLOAD',
        message: (error as Error).message,
        details: [],
      },
    });
    return;
  }

  const bodyError = error as { type?: string; status?: number };
  if (bodyError.type === 'entity.parse.failed') {
    response.status(400).json({
      error: { code: 'INVALID_JSON', message: 'El cuerpo no contiene JSON válido.', details: [] },
    });
    return;
  }
  if (bodyError.type === 'entity.too.large') {
    response.status(413).json({
      error: { code: 'REQUEST_TOO_LARGE', message: 'El cuerpo excede el límite permitido.', details: [] },
    });
    return;
  }

  const databaseError = error as DatabaseError;
  if (databaseError.code === '23505') {
    response.status(409).json({
      error: {
        code: 'RESOURCE_CONFLICT',
        message: 'Ya existe un registro con esos datos.',
        details: databaseError.constraint === undefined ? [] : [databaseError.constraint],
      },
    });
    return;
  }

  if (databaseError.code?.startsWith('23') || databaseError.code === 'P0001') {
    response.status(422).json({
      error: {
        code: 'DOMAIN_RULE_VIOLATION',
        message: databaseError.message,
        details: [],
      },
    });
    return;
  }

  console.error(error);
  response.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'No fue posible completar la operación.',
      details: [],
    },
  });
};
