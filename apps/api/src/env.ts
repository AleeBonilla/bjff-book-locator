import { fileURLToPath } from 'node:url';

import { config } from 'dotenv';
import { z } from 'zod';

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true });

const environmentSchema = z.object({
  API_PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  DATABASE_URL: z.string().min(1),
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  throw new Error(`Configuración de entorno inválida: ${parsedEnvironment.error.message}`);
}

export const env = parsedEnvironment.data;
