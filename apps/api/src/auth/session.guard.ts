import { Injectable, SetMetadata, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { ApiError } from '../common/api-error.js';
import { AuthService } from './auth.service.js';
import { SESSION_COOKIE, SessionStore } from './session.store.js';

export const PUBLIC_ROUTE = 'PUBLIC_ROUTE';

/** Marca la única ruta que no exige sesión: el inicio de sesión. */
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

declare module 'express' {
  interface Request {
    sessionId?: string;
    userId?: number;
  }
}

/**
 * Exige sesión activa en toda la API (FR-004, FR-042).
 *
 * Se aplica de forma global: una ruta nueva queda protegida por omisión y hay que
 * marcarla explícitamente para abrirla. Es la lectura del principio VI: el
 * comportamiento seguro es el predeterminado.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionStore,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.cookies?.[SESSION_COOKIE] as string | undefined;

    const session = this.sessions.get(sessionId);
    if (!session) throw ApiError.unauthenticated();

    const user = await this.auth.findById(session.userId);
    if (!user) {
      // La cuenta se deshabilitó o se eliminó mientras la sesión seguía viva.
      this.sessions.destroy(sessionId);
      throw ApiError.unauthenticated();
    }

    request.sessionId = sessionId;
    request.userId = user.userId;
    return true;
  }
}
