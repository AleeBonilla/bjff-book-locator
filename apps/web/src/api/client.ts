import type {
  ApiErrorBody,
  Carga,
  Paginado,
  ProblemaDeCarga,
  Registro,
  ResumenDeCarga,
  SessionResponse,
} from '@bjff/api-types';

/**
 * Cliente del contrato REST.
 *
 * La interfaz no normaliza códigos ni calcula nada: consume el contrato
 * (principio VIII de la constitución). Toda regla vive en el servicio.
 */

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init });

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Ocurrió un error inesperado.',
      response.status,
    );
  }

  return body as T;
}

export const api = {
  login: (username: string, password: string) =>
    call<SessionResponse>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),

  logout: () => call<void>('/api/auth/logout', { method: 'POST' }),

  session: () => call<SessionResponse>('/api/auth/session'),

  importCollection: (file: File, title: string) => {
    const form = new FormData();
    form.append('file', file);
    const query = title ? `?title=${encodeURIComponent(title)}` : '';
    return call<Carga>(`/api/collection-loads${query}`, { method: 'POST', body: form });
  },

  loads: () => call<Paginado<ResumenDeCarga>>('/api/collection-loads'),

  load: (id: number) => call<Carga>(`/api/collection-loads/${id}`),

  problems: (id: number) =>
    call<Paginado<ProblemaDeCarga>>(`/api/collection-loads/${id}/errors`),

  deleteLoad: (id: number) =>
    call<void>(`/api/collection-loads/${id}`, { method: 'DELETE' }),

  books: (id: number, page: number, pageSize: number, withoutKey = false) => {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(page * pageSize),
    });
    if (withoutKey) params.set('withoutKey', 'true');
    return call<Paginado<Registro>>(
      `/api/collection-loads/${id}/books?${params.toString()}`,
    );
  },
};
