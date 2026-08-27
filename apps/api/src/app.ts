import express from 'express';
import type { Pool } from 'pg';

import { createAdminRouter } from './admin/router.js';
import { pool as defaultPool } from './db/pool.js';
import { env } from './env.js';
import { errorHandler } from './errors.js';
import { SvgStorage } from './maps/storage.js';

interface AppDependencies {
  pool?: Pool;
  storage?: SvgStorage;
}

export function createApp(dependencies: AppDependencies = {}) {
  const app = express();
  const pool = dependencies.pool ?? defaultPool;
  const storage = dependencies.storage ?? new SvgStorage(env.SVG_STORAGE_DIR);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  app.use(
    '/api/assets/maps',
    express.static(storage.absoluteDirectory(), {
      dotfiles: 'deny',
      fallthrough: true,
      immutable: true,
      maxAge: '1y',
      setHeaders(response) {
        response.setHeader('X-Content-Type-Options', 'nosniff');
        response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
      },
    }),
  );

  app.use('/api/admin', createAdminRouter({
    pool,
    storage,
    actorUsername: env.ADMIN_ACTOR_USERNAME,
    allowUnauthenticated: env.ALLOW_UNAUTHENTICATED_ADMIN,
    maxSvgUploadBytes: env.MAX_SVG_UPLOAD_BYTES,
  }));

  app.use((_request, response) => {
    response.status(404).json({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Ruta no encontrada.', details: [] },
    });
  });

  app.use(errorHandler);

  return app;
}
