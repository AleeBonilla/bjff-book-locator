/**
 * Aprovisionamiento de la cuenta ADMIN.
 *
 * No existe registro público de cuentas (FR-005): la primera se crea con este script.
 * Las credenciales se leen del entorno y nunca se imprimen (FR-007, principio VI).
 *
 *   npm run seed:admin -w apps/api
 */

import { createDatabase } from '../src/database/database.module.js';
import { hashPassword } from '../src/auth/password.js';
import { loadConfig } from '../src/config.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const username = process.env.SEED_ADMIN_USERNAME?.trim();
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_FULL_NAME?.trim() || null;

  if (!username || !email || !password) {
    throw new Error(
      'Faltan SEED_ADMIN_USERNAME, SEED_ADMIN_EMAIL o SEED_ADMIN_PASSWORD. Ver .env.example.',
    );
  }

  if (password.length < 12) {
    throw new Error('La contraseña debe tener al menos 12 caracteres.');
  }

  const db = createDatabase(config.databaseUrl);

  try {
    const existing = await db
      .selectFrom('users')
      .select('user_id')
      .where('username', '=', username)
      .executeTakeFirst();

    const passwordHash = await hashPassword(password);

    if (existing) {
      await db
        .updateTable('users')
        .set({ password_hash: passwordHash, enabled: true, updated_at: new Date() })
        .where('user_id', '=', existing.user_id)
        .execute();
      process.stdout.write(`Cuenta actualizada: ${username}\n`);
      return;
    }

    await db
      .insertInto('users')
      .values({
        username,
        email,
        password_hash: passwordHash,
        full_name: fullName,
        role: 'ADMIN',
        enabled: true,
      })
      .execute();

    process.stdout.write(`Cuenta creada: ${username}\n`);
  } finally {
    await db.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Error desconocido'}\n`,
  );
  process.exitCode = 1;
});
