import { createServer } from 'node:http';

import { createApp } from './app.js';
import { pool } from './db/pool.js';
import { env } from './env.js';
import { SvgStorage } from './maps/storage.js';

const storage = new SvgStorage(env.SVG_STORAGE_DIR);
await storage.ensureReady();
const server = createServer(createApp({ storage }));

server.listen(env.API_PORT, () => {
  console.log(`API disponible en http://localhost:${env.API_PORT}`);
});

async function shutdown(signal: string) {
  console.log(`Cerrando la API por ${signal}.`);

  server.close(async (serverError) => {
    await pool.end();

    if (serverError) {
      console.error(serverError);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
