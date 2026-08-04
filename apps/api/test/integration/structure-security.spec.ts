import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../helpers.js';

describe('seguridad de rutas estructurales', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('responde 401 en cada clase de ruta de 003 sin sesión', async () => {
    const routes = [
      ['GET', '/api/structure-templates'],
      ['POST', '/api/structure-templates'],
      ['GET', '/api/structure-templates/1'],
      ['PATCH', '/api/structure-templates/1'],
      ['POST', '/api/structure-templates/1/activate'],
      ['POST', '/api/structure-templates/1/archive'],
      ['POST', '/api/structure-templates/1/nodes'],
      ['PATCH', '/api/structure-templates/1/nodes/1'],
      ['POST', '/api/structure-templates/1/nodes/1/move'],
      ['PUT', '/api/structure-templates/1/nodes/order'],
      ['GET', '/api/structure-templates/1/nodes/1/deletion-preview'],
      ['DELETE', '/api/structure-templates/1/nodes/1'],
      ['GET', '/api/schemes'],
      ['POST', '/api/schemes'],
      ['GET', '/api/schemes/1'],
      ['PATCH', '/api/schemes/1'],
      ['POST', '/api/schemes/1/copy'],
      ['POST', '/api/schemes/1/define'],
      ['POST', '/api/schemes/1/locations'],
      ['PATCH', '/api/schemes/1/locations/1'],
      ['POST', '/api/schemes/1/locations/1/move'],
      ['PUT', '/api/schemes/1/locations/order'],
      ['GET', '/api/schemes/1/locations/1/deletion-preview'],
      ['DELETE', '/api/schemes/1/locations/1'],
      ['PUT', '/api/schemes/1/locations/1/settings'],
      ['DELETE', '/api/schemes/1/locations/1/settings'],
    ] as const;

    for (const [method, path] of routes) {
      const agent = request(app.getHttpServer());
      const response =
        method === 'GET'
          ? await agent.get(path)
          : method === 'POST'
            ? await agent.post(path)
            : method === 'PATCH'
              ? await agent.patch(path)
              : method === 'PUT'
                ? await agent.put(path)
                : await agent.delete(path);
      expect(response.status, `${method} ${path}`).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    }
  });
});
