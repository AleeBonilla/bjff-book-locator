import { pool } from './db/pool.js';
import { env } from './env.js';
import { SvgStorage } from './maps/storage.js';

const storage = new SvgStorage(env.SVG_STORAGE_DIR);

try {
  const result = await storage.reconcile(pool);
  console.log(`Recursos conservados: ${result.kept}; eliminados: ${result.removed}.`);
} finally {
  await pool.end();
}
