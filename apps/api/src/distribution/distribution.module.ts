import { Module } from '@nestjs/common';

import { DistributionController } from './distribution.controller.js';
import { DistributionRepository } from './distribution.repository.js';
import { DistributionService } from './distribution.service.js';
import { PublicSearchController } from './public-search.controller.js';
import { PublicSearchService } from './public-search.service.js';

@Module({
  controllers: [DistributionController, PublicSearchController],
  providers: [DistributionRepository, DistributionService, PublicSearchService],
})
export class DistributionModule {}
