import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

import { APP_CONFIG, type AppConfig } from '../config.js';

/**
 * Sesiones del lado del servidor, en memoria del proceso.
 *
 * FR-003 exige invalidar una sesión de inmediato al cerrarla, cosa que un token
 * autocontenido no permite sin lista de revocación. Guardarlas del lado del servidor
 * lo resuelve borrando una entrada.
 *
 * Límite conocido de la primera versión, registrado en plan.md: el backend corre como
 * una sola instancia y las sesiones se pierden al reiniciar. La salida, cuando haga
 * falta, es una tabla de sesiones, sin afectar al resto del diseño.
 */

export const SESSION_COOKIE = 'bjff_session';

export interface SessionData {
  userId: number;
  expiresAt: number;
}

@Injectable()
export class SessionStore {
  private readonly sessions = new Map<string, SessionData>();

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  create(userId: number): string {
    const id = randomBytes(32).toString('base64url');
    this.sessions.set(id, { userId, expiresAt: Date.now() + this.config.sessionTtlMs });
    return id;
  }

  get(id: string | undefined): SessionData | null {
    if (!id) return null;

    const session = this.sessions.get(id);
    if (!session) return null;

    if (session.expiresAt <= Date.now()) {
      this.sessions.delete(id);
      return null;
    }

    return session;
  }

  destroy(id: string | undefined): void {
    if (id) this.sessions.delete(id);
  }

  /** Retira las sesiones vencidas. Evita que el mapa crezca sin límite. */
  prune(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(id);
    }
  }
}
