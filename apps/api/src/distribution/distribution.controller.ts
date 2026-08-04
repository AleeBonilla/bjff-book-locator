import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type {
  DistributionRunDetail,
  DistributionRunSummary,
  DistributionComparison,
  DistributionDerivationTemplate,
  Paginado,
  PublicSearchResult,
} from '@bjff/api-types';
import type { Request } from 'express';

import {
  ComparisonQueryDto,
  CreateDistributionRunDto,
  DistributionRunsQueryDto,
  PublishDistributionRunDto,
  RecalculateDistributionRunDto,
  ReviewDistributionRangeDto,
  SearchClassificationDto,
} from './distribution.dto.js';
import { DistributionService } from './distribution.service.js';

@Controller('api/distribution-runs')
export class DistributionController {
  constructor(private readonly distributions: DistributionService) {}

  @Get()
  list(
    @Query() query: DistributionRunsQueryDto,
  ): Promise<Paginado<DistributionRunSummary>> {
    return this.distributions.list(query);
  }

  @Post()
  create(
    @Body() command: CreateDistributionRunDto,
    @Req() request: Request,
  ): Promise<DistributionRunDetail> {
    return this.distributions.create(command, request.userId ?? null);
  }

  @Post(':runId/publish')
  @HttpCode(200)
  publish(
    @Param('runId', ParseIntPipe) runId: number,
    @Body() command: PublishDistributionRunDto,
  ): Promise<DistributionRunDetail> {
    return this.distributions.publish(runId, command);
  }

  @Post(':runId/recalculate')
  @HttpCode(200)
  recalculate(
    @Param('runId', ParseIntPipe) runId: number,
    @Body() command: RecalculateDistributionRunDto,
    @Req() request: Request,
  ): Promise<DistributionRunDetail> {
    return this.distributions.recalculate(runId, command, request.userId ?? null);
  }

  @Put(':runId/ranges/:rangeId/review')
  reviewRange(
    @Param('runId', ParseIntPipe) runId: number,
    @Param('rangeId', ParseIntPipe) rangeId: number,
    @Body() command: ReviewDistributionRangeDto,
    @Req() request: Request,
  ): Promise<DistributionRunDetail> {
    return this.distributions.reviewRange(
      runId,
      rangeId,
      command,
      request.userId ?? null,
    );
  }

  @Post(':runId/test-search')
  @HttpCode(200)
  testSearch(
    @Param('runId', ParseIntPipe) runId: number,
    @Body() command: SearchClassificationDto,
  ): Promise<PublicSearchResult> {
    return this.distributions.testSearch(runId, command.classificationCode);
  }

  @Get(':runId/derivation-template')
  derivationTemplate(
    @Param('runId', ParseIntPipe) runId: number,
  ): Promise<DistributionDerivationTemplate> {
    return this.distributions.derivationTemplate(runId);
  }

  @Get(':runId/comparison')
  comparison(
    @Param('runId', ParseIntPipe) runId: number,
    @Query() query: ComparisonQueryDto,
  ): Promise<DistributionComparison> {
    return this.distributions.comparison(runId, query.againstRunId);
  }

  @Get(':runId')
  detail(@Param('runId', ParseIntPipe) runId: number): Promise<DistributionRunDetail> {
    return this.distributions.detail(runId);
  }
}
