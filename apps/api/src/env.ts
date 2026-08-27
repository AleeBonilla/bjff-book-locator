import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { config } from 'dotenv';
import { z } from 'zod';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  DATABASE_URL: z.string().min(1),
  ADMIN_ACTOR_USERNAME: z.string().trim().min(1).default('system-v1'),
  ALLOW_UNAUTHENTICATED_ADMIN: z.stringbool().default(true),
  SVG_STORAGE_DIR: z.string().trim().min(1).default('./var/maps'),
  MAX_SVG_UPLOAD_BYTES: z.coerce.number().int().positive().default(10_485_760),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  throw new Error(`Configuración de entorno inválida: ${parsedEnvironment.error.message}`);
}

if (
  parsedEnvironment.data.NODE_ENV === 'production'
  && parsedEnvironment.data.ALLOW_UNAUTHENTICATED_ADMIN
) {
  throw new Error('La API administrativa sin autenticación no puede ejecutarse en producción.');
}

export const env = {
  ...parsedEnvironment.data,
  SVG_STORAGE_DIR: resolve(parsedEnvironment.data.SVG_STORAGE_DIR),
};
