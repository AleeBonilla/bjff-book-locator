import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Configuración leída del entorno.
 *
 * Ningún secreto vive en el repositorio (principio VI de la constitución). Los
 * valores por omisión son solo los de desarrollo y nunca incluyen credenciales
 * reales.
 */

/**
 * Carga el `.env` del repositorio si existe.
 *
 * Usa `loadEnvFile` del núcleo de Node: evita una dependencia y hace que el flujo
 * documentado en el README funcione tal como está escrito. Las variables ya presentes
 * en el entorno tienen prioridad, así que despliegues y pruebas pueden sobrescribirlas.
 */
function loadEnvFileIfPresent(): void {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];

  const found = candidates.find((path) => existsSync(path));
  if (!found) return;

  try {
    process.loadEnvFile(found);
  } catch {
    // Un `.env` ilegible no debe impedir arrancar con variables del entorno.
  }
}

function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`La variable ${name} debe ser un entero positivo.`);
  }
  return parsed;
}

function readBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  return raw.toLowerCase() === 'true';
}

export interface AppConfig {
  databaseUrl: string;
  port: number;
  webOrigin: string;
  cookieSecure: boolean;
  sessionTtlMs: number;
  /** Límites de FR-013a. Holgados respecto del volumen previsto en SC-006. */
  importMaxFileBytes: number;
  importMaxRows: number;
}

export function loadConfig(): AppConfig {
  loadEnvFileIfPresent();

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Falta la variable DATABASE_URL. Ver .env.example.');
  }

  return {
    databaseUrl,
    port: readInt('API_PORT', 3000),
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    cookieSecure: readBool('COOKIE_SECURE', false),
    sessionTtlMs: readInt('SESSION_TTL_MINUTES', 480) * 60_000,
    importMaxFileBytes: readInt('IMPORT_MAX_FILE_BYTES', 50 * 1024 * 1024),
    importMaxRows: readInt('IMPORT_MAX_ROWS', 200_000),
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
