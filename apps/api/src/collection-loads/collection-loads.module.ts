import { Module } from '@nestjs/common';

import { CollectionLoadsController } from './collection-loads.controller.js';
import { CollectionLoadsQueryService } from './collection-loads.query.service.js';
import { CollectionLoadsRepository } from './collection-loads.repository.js';
import { CsvReaderService } from './csv-reader.service.js';
import { FileValidationService } from './file-validation.service.js';
import { ImportService } from './import.service.js';

@Module({
  controllers: [CollectionLoadsController],
  providers: [
    CsvReaderService,
    FileValidationService,
    CollectionLoadsRepository,
    CollectionLoadsQueryService,
    ImportService,
  ],
})
export class CollectionLoadsModule {}
