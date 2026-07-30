/**
 * Registro estructurado.
 *
 * Desarrolla el principio IX de la constitución y FR-043a a FR-043c: las operaciones
 * largas registran inicio, fin y desenlace, correlacionables por el identificador de
 * la carga, y sin contenido de filas de la colección, credenciales ni identificadores
 * de sesión.
 *
 * La lista de claves prohibidas es una red de seguridad, no la regla: quien registra
 * debe pasar solo identificadores, conteos y desenlaces.
 */

export type LogLevel = 'info' | 'warn' | 'error';

/** Claves cuyo valor nunca debe aparecer en un registro. */
const FORBIDDEN_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'rawcontent',
  'raw_content',
  'sessionid',
  'session_id',
  'cookie',
  'authorization',
  'title',
  'author',
  'isbn',
  'classificationraw',
  'classification_raw',
  'sourcebarcode',
  'source_barcode',
]);

export type LogFields = Record<string, string | number | boolean | null | undefined>;

function sanitize(fields: LogFields): LogFields {
  const safe: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      safe[key] = '[omitido]';
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

function emit(level: LogLevel, event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...sanitize(fields),
  });
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};
