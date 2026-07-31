import { Module } from '@nestjs/common';

import { SchemesController } from './schemes.controller.js';
import { SchemesRepository } from './schemes.repository.js';
import { SchemesService } from './schemes.service.js';

@Module({
  controllers: [SchemesController],
  providers: [SchemesRepository, SchemesService],
})
export class SchemesModule {}
