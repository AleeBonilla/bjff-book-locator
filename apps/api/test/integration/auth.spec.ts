import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ADMIN, createApp, login, seedAdmin } from '../helpers.js';
import { testDb } from '../setup.js';

/** T019 — Acceso administrativo (FR-001 a FR-004, FR-006). */
describe('acceso administrativo', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('concede sesión con credenciales válidas (FR-001)', async () => {
    await seedAdmin();

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: ADMIN.username, password: ADMIN.password })
      .expect(200);

    expect(response.body.user.username).toBe(ADMIN.username);
    expect(response.body.user.role).toBe('ADMIN');
    expect(response.headers['set-cookie']).toBeDefined();
  });

  it('registra el último acceso (FR-006)', async () => {
    const userId = await seedAdmin();
    await login(app);

    const user = await testDb
      .selectFrom('users')
      .select('last_login_at')
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();

    expect(user.last_login_at).not.toBeNull();
  });

  it('responde igual ante credencial inválida y cuenta inexistente (FR-002)', async () => {
    await seedAdmin();

    const wrongPassword = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: ADMIN.username, password: 'contrasena-equivocada' })
      .expect(401);

    const unknownUser = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'no_existe', password: 'contrasena-equivocada' })
      .expect(401);

    expect(wrongPassword.body).toEqual(unknownUser.body);
    expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rechaza una cuenta deshabilitada con el mismo error (FR-002)', async () => {
    await seedAdmin(false);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: ADMIN.username, password: ADMIN.password })
      .expect(401);

    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('invalida la sesión de inmediato al cerrarla (FR-003)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    await request(app.getHttpServer())
      .get('/api/auth/session')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/auth/session')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('exige sesión en toda función administrativa (FR-004, FR-042)', async () => {
    for (const path of [
      '/api/auth/session',
      '/api/collection-loads',
      '/api/collection-loads/1',
      '/api/collection-loads/1/errors',
      '/api/collection-loads/1/books',
    ]) {
      const response = await request(app.getHttpServer()).get(path).expect(401);
      expect(response.body.error.code).toBe('UNAUTHENTICATED');
    }

    await request(app.getHttpServer()).post('/api/collection-loads').expect(401);
  });

  it('no expone el hash de la contraseña en ninguna respuesta (FR-007)', async () => {
    await seedAdmin();
    const cookie = await login(app);

    const response = await request(app.getHttpServer())
      .get('/api/auth/session')
      .set('Cookie', cookie)
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain('scrypt');
  });
});
