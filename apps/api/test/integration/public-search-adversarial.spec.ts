import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp, seedAdmin, seedPublishedDistribution } from '../helpers.js';

describe('búsqueda pública ante entradas adversariales', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('no inventa ubicaciones para códigos vacíos, ambiguos o hostiles', async () => {
    const adminId = await seedAdmin();
    await seedPublishedDistribution(adminId);
    const invalidCodes = [
      '',
      '   ',
      '. - ,',
      '@@@',
      'ABC',
      '100<script>alert(1)</script>',
      '100 OR 1=1',
      "100' UNION SELECT 1",
      '100 A123 DROP',
      '１２３',
      '\u0000',
    ];

    const responses = await Promise.all(
      invalidCodes.map((classificationCode) =>
        request(app.getHttpServer())
          .post('/api/public/search')
          .send({ classificationCode })
          .expect(200),
      ),
    );

    for (const response of responses) {
      expect(response.body).toMatchObject({
        status: 'NOT_FOUND',
        matchType: null,
        locations: [],
      });
    }
  });

  it('rechaza cuerpos mal tipados, campos extra y límites excedidos', async () => {
    const invalidBodies: Array<Record<string, unknown>> = [
      {},
      { classificationCode: null },
      { classificationCode: 100 },
      { classificationCode: ['100'] },
      { classificationCode: '1'.repeat(61) },
      { classificationCode: '100', returnTo: 'https://example.com/phishing' },
    ];

    for (const body of invalidBodies) {
      const response = await request(app.getHttpServer())
        .post('/api/public/search')
        .send(body)
        .expect(400);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('responde de forma controlada ante JSON truncado', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/search')
      .set('Content-Type', 'application/json')
      .send('{"classificationCode":')
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('soporta una ráfaga concurrente sin mezclar respuestas ni fallar', async () => {
    const adminId = await seedAdmin();
    await seedPublishedDistribution(adminId);

    const responses = await Promise.all(
      Array.from({ length: 64 }, (_, index) =>
        request(app.getHttpServer())
          .post('/api/public/search')
          .send({ classificationCode: index % 2 === 0 ? '100' : `@@@${index}` })
          .expect(200),
      ),
    );

    responses.forEach((response, index) => {
      expect(response.body.status).toBe(index % 2 === 0 ? 'FOUND' : 'NOT_FOUND');
    });
  });
});

describe('entrega de una búsqueda a la interfaz pública', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(async () => app.close());

  it('es pública y redirige con 303 conservando el código sin normalizar', async () => {
    const classificationCode = ' 658. 8 T111-t 23 ';
    const response = await request(app.getHttpServer())
      .post('/api/public/search/open')
      .send({ classificationCode })
      .expect(303);

    const location = new URL(response.headers.location as string);
    expect(location.origin).toBe(
      new URL(process.env.WEB_ORIGIN ?? 'http://localhost:5173').origin,
    );
    expect(location.pathname).toBe('/buscar');
    expect(location.searchParams.get('codigo')).toBe(classificationCode);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['referrer-policy']).toBe('no-referrer');
  });

  it('codifica separadores y saltos de línea sin permitir inyección de cabeceras', async () => {
    const classificationCode = '100\r\nLocation: https://example.com';
    const response = await request(app.getHttpServer())
      .post('/api/public/search/open')
      .send({ classificationCode })
      .expect(303);

    const locationHeader = response.headers.location as string;
    expect(locationHeader).not.toMatch(/[\r\n]/);
    expect(new URL(locationHeader).searchParams.get('codigo')).toBe(classificationCode);
    expect(new URL(locationHeader).origin).not.toBe('https://example.com');
  });

  it('no acepta que el cliente elija otro destino', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/public/search/open')
      .send({ classificationCode: '100', returnTo: 'https://example.com/phishing' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('mantiene el límite del body y no expone una variante GET', async () => {
    await request(app.getHttpServer())
      .post('/api/public/search/open')
      .send({ classificationCode: '1'.repeat(61) })
      .expect(400);
    await request(app.getHttpServer()).get('/api/public/search/open').expect(404);
  });
});
