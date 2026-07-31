import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

/**
 * Hash de contraseñas con `scrypt` del núcleo de Node (FR-007).
 *
 * Sin dependencias nativas ni compilación. Los parámetros siguen la recomendación de
 * OWASP para scrypt. Quedan almacenados junto al hash para poder endurecerlos más
 * adelante sin invalidar las contraseñas existentes.
 *
 * Formato: `scrypt$N$r$p$salt$hash`, ambos en base64.
 */

// `promisify` no conserva la sobrecarga de `scrypt` que acepta opciones.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const COST = 2 ** 15;
const BLOCK_SIZE = 8;
const PARALLELISM = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

/**
 * `scrypt` necesita unos `128 * N * r` bytes: con estos parámetros, 32 MiB exactos.
 * El límite por omisión de Node es también 32 MiB y la comprobación es estricta, así
 * que hay que declararlo o la derivación falla.
 */
const MAX_MEMORY = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  if (password.length === 0) {
    throw new Error('La contraseña no puede estar vacía.');
  }

  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
    maxmem: MAX_MEMORY,
  });

  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const cost = Number.parseInt(parts[1] ?? '', 10);
  const blockSize = Number.parseInt(parts[2] ?? '', 10);
  const parallelism = Number.parseInt(parts[3] ?? '', 10);
  if (!cost || !blockSize || !parallelism) return false;

  const salt = Buffer.from(parts[4] ?? '', 'base64');
  const expected = Buffer.from(parts[5] ?? '', 'base64');
  if (salt.length === 0 || expected.length === 0) return false;

  let derived: Buffer;
  try {
    derived = await scryptAsync(password, salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelism,
      maxmem: MAX_MEMORY,
    });
  } catch {
    // Parámetros almacenados fuera de lo admitido: se trata como no coincidente.
    return false;
  }

  // Comparación de tiempo constante: no debe filtrar información por la duración.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
