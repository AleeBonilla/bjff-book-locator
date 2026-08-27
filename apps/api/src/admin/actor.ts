import type { Queryable } from '../db/transaction.js';
import { ApiError } from '../errors.js';

export interface ActorContext {
  userId: number;
  username: string;
}

export async function resolveActor(
  database: Queryable,
  username: string,
): Promise<ActorContext> {
  const result = await database.query<{ user_id: number; username: string }>(
    `SELECT user_id, username
       FROM users
      WHERE lower(username) = lower($1)`,
    [username],
  );
  const actor = result.rows[0];
  if (actor === undefined) {
    throw new ApiError(
      500,
      'ADMIN_ACTOR_NOT_CONFIGURED',
      'El usuario técnico administrativo no existe en la base de datos.',
    );
  }
  return { userId: actor.user_id, username: actor.username };
}
