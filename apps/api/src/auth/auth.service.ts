import { Inject, Injectable } from '@nestjs/common';
import type { Usuario } from '@bjff/api-types';

import { ApiError } from '../common/api-error.js';
import { DATABASE, type Db } from '../database/database.module.js';
import type { UserRow } from '../database/schema.types.js';
import { verifyPassword } from './password.js';

@Injectable()
export class AuthService {
  constructor(@Inject(DATABASE) private readonly db: Db) {}

  /**
   * Valida credenciales y devuelve la cuenta.
   *
   * FR-002: una credencial inválida y una cuenta deshabilitada producen exactamente el
   * mismo error. Cuando la cuenta no existe se verifica igualmente una contraseña
   * ficticia, para que la duración de la respuesta tampoco distinga los casos.
   */
  async authenticate(username: string, password: string): Promise<Usuario> {
    const user = await this.db
      .selectFrom('users')
      .selectAll()
      .where('username', '=', username)
      .executeTakeFirst();

    const storedHash = user?.password_hash ?? DUMMY_HASH;
    const passwordMatches = await verifyPassword(password, storedHash);

    if (!user || !user.enabled || !passwordMatches) {
      throw ApiError.invalidCredentials();
    }

    await this.db
      .updateTable('users')
      .set({ last_login_at: new Date() })
      .where('user_id', '=', user.user_id)
      .execute();

    return toUsuario(user);
  }

  async findById(userId: number): Promise<Usuario | null> {
    const user = await this.db
      .selectFrom('users')
      .selectAll()
      .where('user_id', '=', userId)
      .where('enabled', '=', true)
      .executeTakeFirst();

    return user ? toUsuario(user) : null;
  }
}

function toUsuario(user: UserRow): Usuario {
  return {
    userId: user.user_id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
  };
}

/**
 * Hash con parámetros válidos que ninguna contraseña satisface. Sirve para gastar el
 * mismo tiempo de cómputo cuando la cuenta no existe.
 */
const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
