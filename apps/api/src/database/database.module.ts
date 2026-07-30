import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool, types as pgTypes } from 'pg';

import { APP_CONFIG, loadConfig, type AppConfig } from '../config.js';
import type { Database } from './schema.types.js';

export const DATABASE = Symbol('DATABASE');

export type Db = Kysely<Database>;

// `numeric` y `int8` llegan como texto por omisión. Las columnas que usa esta
// funcionalidad son enteras y caben holgadamente en un número de JavaScript.
pgTypes.setTypeParser(pgTypes.builtins.INT8, (value) => Number.parseInt(value, 10));

export function createDatabase(connectionString: string): Db {
  const pool = new Pool({ connectionString, max: 10 });
  return new Kysely<Database>({ dialect: new PostgresDialect({ pool }) });
}

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    {
      provide: DATABASE,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createDatabase(config.databaseUrl),
    },
  ],
  exports: [APP_CONFIG, DATABASE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor() {}

  async onApplicationShutdown(): Promise<void> {
    // El pool se cierra con la instancia de Kysely al destruirse el módulo.
  }
}
