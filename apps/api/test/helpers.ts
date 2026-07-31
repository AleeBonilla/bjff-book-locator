import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/password.js';
import { ErrorEnvelopeFilter } from '../src/common/error-envelope.filter.js';
import { testDb } from './setup.js';

/** Archivo publicable de referencia; las pruebas nunca usan la colección privada. */
export const EXAMPLE_CSV_PATH = (() => {
  // El directorio de trabajo depende de dónde se invoque Vitest.
  const candidates = [
    resolve(process.cwd(), 'bjff-collection-example.csv'),
    resolve(process.cwd(), '../../bjff-collection-example.csv'),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error('No se encontró bjff-collection-example.csv.');
  return found;
})();

export function exampleCsv(): Buffer {
  return readFileSync(EXAMPLE_CSV_PATH);
}

/** Contadores esperados del archivo de ejemplo (SC-002). */
export const EXAMPLE_EXPECTED = {
  rowsRead: 47,
  rowsImported: 47,
  rowsRejected: 0,
  rowsWithoutKey: 1,
  rowsFlagged: 5,
} as const;

export const ADMIN = {
  username: 'admin_prueba',
  email: 'admin@prueba.test',
  password: 'contrasena-de-prueba-123',
} as const;

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ErrorEnvelopeFilter());

  await app.init();
  return app;
}

export async function seedAdmin(enabled = true): Promise<number> {
  const row = await testDb
    .insertInto('users')
    .values({
      username: ADMIN.username,
      email: ADMIN.email,
      password_hash: await hashPassword(ADMIN.password),
      full_name: 'Persona de prueba',
      role: 'ADMIN',
      enabled,
    })
    .returning('user_id')
    .executeTakeFirstOrThrow();

  return row.user_id;
}

/** Inicia sesión y devuelve la cookie para las peticiones siguientes. */
export async function login(app: INestApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ username: ADMIN.username, password: ADMIN.password })
    .expect(200);

  const cookies = response.headers['set-cookie'] as unknown as string[];
  return cookies[0]!.split(';')[0]!;
}

export async function importFile(
  app: INestApplication,
  cookie: string,
  content: Buffer,
  filename = 'bjff-collection-example.csv',
) {
  return request(app.getHttpServer())
    .post('/api/collection-loads')
    .set('Cookie', cookie)
    .attach('file', content, filename);
}
