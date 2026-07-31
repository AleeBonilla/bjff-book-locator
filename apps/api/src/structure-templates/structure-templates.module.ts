import { Module } from '@nestjs/common';

import { StructureTemplatesController } from './structure-templates.controller.js';
import { StructureTemplatesRepository } from './structure-templates.repository.js';
import { StructureTemplatesService } from './structure-templates.service.js';

@Module({
  controllers: [StructureTemplatesController],
  providers: [StructureTemplatesRepository, StructureTemplatesService],
  exports: [StructureTemplatesRepository, StructureTemplatesService],
})
export class StructureTemplatesModule {}
