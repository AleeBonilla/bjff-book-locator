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

export async function seedTemplate(
  createdBy: number,
  options: { name?: string; status?: 'DRAFT' | 'ACTIVE'; enabled?: boolean } = {},
): Promise<{ templateId: number; rootId: number; positionId: number }> {
  const template = await testDb
    .insertInto('structure_templates')
    .values({
      name: options.name ?? 'Plantilla sintética',
      description: null,
      status: 'DRAFT',
      enabled: options.enabled ?? true,
      created_by: createdBy,
    })
    .returning('structure_template_id')
    .executeTakeFirstOrThrow();

  const root = await testDb
    .insertInto('structure_template_nodes')
    .values({
      structure_template_id: template.structure_template_id,
      parent_template_node_id: null,
      name: 'Contenedor sintético',
      role: 'CONTAINER',
      sort_order: 0,
      visual_kind: null,
      default_capacity_value: null,
      default_capacity_unit: null,
      default_target_fill_ratio: null,
      default_allow_overflow: null,
      enabled: true,
    })
    .returning('structure_template_node_id')
    .executeTakeFirstOrThrow();

  const position = await testDb
    .insertInto('structure_template_nodes')
    .values({
      structure_template_id: template.structure_template_id,
      parent_template_node_id: root.structure_template_node_id,
      name: 'Posición sintética',
      role: 'POSITION',
      sort_order: 0,
      visual_kind: null,
      default_capacity_value: null,
      default_capacity_unit: null,
      default_target_fill_ratio: null,
      default_allow_overflow: null,
      enabled: true,
    })
    .returning('structure_template_node_id')
    .executeTakeFirstOrThrow();

  if (options.status === 'ACTIVE') {
    await testDb
      .updateTable('structure_templates')
      .set({ status: 'ACTIVE' })
      .where('structure_template_id', '=', template.structure_template_id)
      .execute();
  }

  return {
    templateId: template.structure_template_id,
    rootId: root.structure_template_node_id,
    positionId: position.structure_template_node_id,
  };
}

export async function seedScheme(
  createdBy: number,
  options: { name?: string; status?: 'DRAFT' | 'DEFINED'; enabled?: boolean } = {},
): Promise<number> {
  const scheme = await testDb
    .insertInto('schemes')
    .values({
      name: options.name ?? 'Scheme sintético',
      description: null,
      status: options.status ?? 'DRAFT',
      enabled: options.enabled ?? true,
      is_active: false,
      based_on_scheme_id: null,
      created_by: createdBy,
    })
    .returning('scheme_id')
    .executeTakeFirstOrThrow();

  return scheme.scheme_id;
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
