import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { comparableKey } from '@bjff/classification';
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

export async function seedDoneLoad(
  createdBy: number,
  keys: Array<string | null> = ['100', '200', '300'],
): Promise<{ loadId: number; bookIds: number[] }> {
  const load = await testDb
    .insertInto('collection_loads')
    .values({
      title: 'Carga sintética de distribución',
      filename: 'distribucion-sintetica.csv',
      status: 'DONE',
      rows_read: keys.length,
      rows_imported: keys.length,
      rows_without_key: keys.filter((key) => key === null).length,
      rows_flagged: 0,
      rows_rejected: 0,
      created_by: createdBy,
    })
    .returning('collection_load_id')
    .executeTakeFirstOrThrow();

  const books = await testDb
    .insertInto('books')
    .values(
      keys.map((key, index) => ({
        collection_load_id: load.collection_load_id,
        source_row_number: index + 1,
        source_barcode: `SYN${String(index + 1).padStart(4, '0')}`,
        classification_raw: key,
        comparable_key: key === null ? null : comparableKey(key),
        isbn: null,
        title: `Libro sintético ${index + 1}`,
        author: null,
        copy_label: null,
        year: null,
      })),
    )
    .returning('book_id')
    .execute();

  return {
    loadId: load.collection_load_id,
    bookIds: books.map((book) => book.book_id),
  };
}

export async function seedDistributionStructure(
  createdBy: number,
  positionCount = 3,
  label = 'sintética',
): Promise<{
  schemeId: number;
  templateId: number;
  rootLocationId: number;
  positionIds: number[];
}> {
  const template = await seedTemplate(createdBy, {
    name: `Plantilla de distribución ${label}`,
    status: 'ACTIVE',
  });
  const schemeId = await seedScheme(createdBy, {
    name: `Scheme de distribución ${label}`,
    status: 'DEFINED',
  });
  const root = await testDb
    .insertInto('locations')
    .values({
      scheme_id: schemeId,
      structure_template_id: template.templateId,
      structure_template_node_id: template.rootId,
      parent_location_id: null,
      name: 'Sección sintética',
      sort_order: 0,
      leaf_sequence: null,
      map_element_id: null,
      enabled: true,
    })
    .returning('location_id')
    .executeTakeFirstOrThrow();

  const positions = await testDb
    .insertInto('locations')
    .values(
      Array.from({ length: positionCount }, (_, index) => ({
        scheme_id: schemeId,
        structure_template_id: template.templateId,
        structure_template_node_id: template.positionId,
        parent_location_id: root.location_id,
        name: `Anaquel ${index + 1}`,
        sort_order: index,
        leaf_sequence: index + 1,
        map_element_id: null,
        enabled: true,
      })),
    )
    .returning('location_id')
    .execute();

  await testDb
    .insertInto('location_distribution_settings')
    .values(
      positions.map((position) => ({
        location_id: position.location_id,
        scheme_id: schemeId,
        capacity_value: 10,
        capacity_unit: 'BOOKS' as const,
        target_fill_ratio: 1,
        allow_overflow: false,
        inherit_to_descendants: false,
        updated_by: createdBy,
      })),
    )
    .execute();

  return {
    schemeId,
    templateId: template.templateId,
    rootLocationId: root.location_id,
    positionIds: positions.map((position) => position.location_id),
  };
}

export async function seedPublishedDistribution(createdBy: number): Promise<{
  runId: number;
  schemeId: number;
  loadId: number;
  positionId: number;
  bookIds: number[];
}> {
  const structure = await seedDistributionStructure(createdBy, 1);
  const load = await seedDoneLoad(createdBy);
  await testDb
    .updateTable('schemes')
    .set({ status: 'DISTRIBUTED' })
    .where('scheme_id', '=', structure.schemeId)
    .execute();
  const run = await testDb
    .insertInto('distribution_runs')
    .values({
      scheme_id: structure.schemeId,
      collection_load_id: load.loadId,
      based_on_distribution_run_id: null,
      strategy: 'HYBRID',
      parameters: {},
      status: 'DONE',
      default_capacity_value: 10,
      default_capacity_unit: 'BOOKS',
      default_target_fill_ratio: 1,
      default_allow_overflow: false,
      book_count: load.bookIds.length,
      position_count: 1,
      unassigned_count: 0,
      is_published: true,
      published_at: new Date(),
      error_message: null,
      created_by: createdBy,
      finished_at: new Date(),
      revision: 1,
    })
    .returning('distribution_run_id')
    .executeTakeFirstOrThrow();
  const positionId = structure.positionIds[0]!;
  await testDb
    .insertInto('distribution_position_inputs')
    .values({
      distribution_run_id: run.distribution_run_id,
      scheme_id: structure.schemeId,
      location_id: positionId,
      position_sequence: 1,
      capacity_value: 10,
      capacity_unit: 'BOOKS',
      target_fill_ratio: 1,
      allow_overflow: false,
      resolution: {
        capacity: { source: 'LOCATION', sourceId: positionId },
        targetFillRatio: { source: 'LOCATION', sourceId: positionId },
        allowOverflow: { source: 'LOCATION', sourceId: positionId },
      },
    })
    .execute();
  await testDb
    .insertInto('distribution_ranges')
    .values({
      distribution_run_id: run.distribution_run_id,
      scheme_id: structure.schemeId,
      location_id: positionId,
      range_sequence: 1,
      range_start_key: '',
      range_end_key: '~',
      range_start_code: null,
      range_end_code: null,
      source: 'AUTO',
      book_count: load.bookIds.length,
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
    })
    .execute();
  await testDb
    .insertInto('book_placements')
    .values(
      load.bookIds.map((bookId) => ({
        distribution_run_id: run.distribution_run_id,
        scheme_id: structure.schemeId,
        collection_load_id: load.loadId,
        book_id: bookId,
        location_id: positionId,
        source: 'AUTO' as const,
      })),
    )
    .execute();
  await testDb
    .updateTable('schemes')
    .set({ status: 'DISTRIBUTED', is_active: true })
    .where('scheme_id', '=', structure.schemeId)
    .execute();
  return {
    runId: run.distribution_run_id,
    schemeId: structure.schemeId,
    loadId: load.loadId,
    positionId,
    bookIds: load.bookIds,
  };
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
