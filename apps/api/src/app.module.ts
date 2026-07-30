import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from './auth/auth.module.js';
import { SessionGuard } from './auth/session.guard.js';
import { CollectionLoadsModule } from './collection-loads/collection-loads.module.js';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, CollectionLoadsModule],
  providers: [
    // Guarda global: una ruta nueva queda protegida por omisión y hay que abrirla
    // explícitamente con @Public() (FR-004, principio VI).
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
})
export class AppModule {}
