import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from '../../src/auth/password.js';

/** T018 — Hash y verificación de contraseñas (FR-007). */
describe('hash de contraseñas', () => {
  it('verifica la contraseña correcta', async () => {
    const hash = await hashPassword('contrasena-de-prueba-123');
    expect(await verifyPassword('contrasena-de-prueba-123', hash)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('contrasena-de-prueba-123');
    expect(await verifyPassword('otra-contrasena-distinta', hash)).toBe(false);
  });

  it('nunca almacena la contraseña original', async () => {
    const password = 'contrasena-de-prueba-123';
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
  });

  it('usa una sal distinta en cada hash', async () => {
    const a = await hashPassword('misma-contrasena-123');
    const b = await hashPassword('misma-contrasena-123');
    expect(a).not.toBe(b);
    expect(await verifyPassword('misma-contrasena-123', a)).toBe(true);
    expect(await verifyPassword('misma-contrasena-123', b)).toBe(true);
  });

  it('rechaza un hash con formato inválido en lugar de fallar', async () => {
    expect(await verifyPassword('cualquiera', 'no-es-un-hash')).toBe(false);
    expect(await verifyPassword('cualquiera', '')).toBe(false);
  });

  it('rechaza una contraseña vacía al crear el hash', async () => {
    await expect(hashPassword('')).rejects.toThrow();
  });
});
