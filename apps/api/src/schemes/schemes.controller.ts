import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type {
  Paginado,
  Scheme,
  SchemeDetail,
  SchemeLocation,
  SubtreePreview,
} from '@bjff/api-types';
import type { Request, Response } from 'express';

import { PageQueryDto } from '../common/structure.dto.js';
import {
  CreateLocationDto,
  CreateSchemeDto,
  CopySchemeDto,
  MoveLocationDto,
  OrderLocationsDto,
  ReplaceLocationSettingsDto,
  UpdateLocationDto,
  UpdateSchemeDto,
} from './schemes.dto.js';
import { SchemesService } from './schemes.service.js';

@Controller('api/schemes')
export class SchemesController {
  constructor(private readonly schemes: SchemesService) {}

  @Get()
  list(
    @Query() page: PageQueryDto,
    @Query('status') status?: 'DRAFT' | 'DEFINED' | 'DISTRIBUTED',
    @Query('enabled') enabled?: string,
  ): Promise<Paginado<Scheme>> {
    return this.schemes.list({
      status,
      enabled: enabled === undefined ? undefined : enabled === 'true',
      limit: page.limit,
      offset: page.offset,
    });
  }

  @Post()
  create(@Req() request: Request, @Body() dto: CreateSchemeDto): Promise<SchemeDetail> {
    return this.schemes.create(dto, request.userId ?? null);
  }

  @Get(':schemeId')
  detail(@Param('schemeId', ParseIntPipe) schemeId: number): Promise<SchemeDetail> {
    return this.schemes.detail(schemeId);
  }

  @Patch(':schemeId')
  update(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Body() dto: UpdateSchemeDto,
  ): Promise<SchemeDetail> {
    return this.schemes.update(schemeId, dto);
  }

  @Post(':schemeId/define')
  @HttpCode(200)
  define(@Param('schemeId', ParseIntPipe) schemeId: number): Promise<SchemeDetail> {
    return this.schemes.define(schemeId);
  }

  @Post(':schemeId/copy')
  copy(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Req() request: Request,
    @Body() dto: CopySchemeDto,
  ): Promise<SchemeDetail> {
    return this.schemes.copy(schemeId, dto, request.userId ?? null);
  }

  @Post(':schemeId/locations')
  createLocation(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Body() dto: CreateLocationDto,
  ): Promise<SchemeLocation> {
    return this.schemes.createLocation(schemeId, dto);
  }

  @Patch(':schemeId/locations/:locationId')
  updateLocation(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Param('locationId', ParseIntPipe) locationId: number,
    @Body() dto: UpdateLocationDto,
  ): Promise<SchemeLocation> {
    return this.schemes.updateLocation(schemeId, locationId, dto);
  }

  @Post(':schemeId/locations/:locationId/move')
  @HttpCode(204)
  async moveLocation(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Param('locationId', ParseIntPipe) locationId: number,
    @Body() dto: MoveLocationDto,
  ): Promise<void> {
    await this.schemes.moveLocation(schemeId, locationId, dto);
  }

  @Put(':schemeId/locations/order')
  @HttpCode(204)
  async orderLocations(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Body() dto: OrderLocationsDto,
  ): Promise<void> {
    await this.schemes.orderLocations(schemeId, dto);
  }

  @Get(':schemeId/locations/:locationId/deletion-preview')
  deletionPreview(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Param('locationId', ParseIntPipe) locationId: number,
  ): Promise<SubtreePreview> {
    return this.schemes.deletionPreview(schemeId, locationId);
  }

  @Delete(':schemeId/locations/:locationId')
  @HttpCode(204)
  async deleteLocation(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Param('locationId', ParseIntPipe) locationId: number,
    @Query('confirmed') confirmed?: string,
  ): Promise<void> {
    await this.schemes.deleteLocation(schemeId, locationId, confirmed === 'true');
  }

  @Put(':schemeId/locations/:locationId/settings')
  async replaceSettings(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Param('locationId', ParseIntPipe) locationId: number,
    @Body() dto: ReplaceLocationSettingsDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SchemeLocation | undefined> {
    const location = await this.schemes.replaceSettings(
      schemeId,
      locationId,
      dto,
      request.userId ?? null,
    );
    if (!location) {
      response.status(204);
      return undefined;
    }
    return location;
  }

  @Delete(':schemeId/locations/:locationId/settings')
  @HttpCode(204)
  async deleteSettings(
    @Param('schemeId', ParseIntPipe) schemeId: number,
    @Param('locationId', ParseIntPipe) locationId: number,
  ): Promise<void> {
    await this.schemes.deleteSettings(schemeId, locationId);
  }
}
