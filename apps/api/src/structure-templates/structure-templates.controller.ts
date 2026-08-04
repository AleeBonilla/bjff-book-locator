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
} from '@nestjs/common';
import type {
  Paginado,
  StructureTemplate,
  StructureTemplateDetail,
  SubtreePreview,
  TemplateNode,
} from '@bjff/api-types';
import type { Request } from 'express';

import { PageQueryDto } from '../common/structure.dto.js';
import {
  CreateStructureTemplateDto,
  CreateTemplateNodeDto,
  MoveTemplateNodeDto,
  OrderTemplateNodesDto,
  UpdateStructureTemplateDto,
  UpdateTemplateNodeDto,
} from './structure-templates.dto.js';
import { StructureTemplatesService } from './structure-templates.service.js';

@Controller('api/structure-templates')
export class StructureTemplatesController {
  constructor(private readonly templates: StructureTemplatesService) {}

  @Get()
  list(
    @Query() page: PageQueryDto,
    @Query('status') status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
    @Query('enabled') enabled?: string,
  ): Promise<Paginado<StructureTemplate>> {
    return this.templates.list({
      status,
      enabled: enabled === undefined ? undefined : enabled === 'true',
      limit: page.limit,
      offset: page.offset,
    });
  }

  @Post()
  create(
    @Req() request: Request,
    @Body() dto: CreateStructureTemplateDto,
  ): Promise<StructureTemplateDetail> {
    return this.templates.create(dto, request.userId ?? null);
  }

  @Get(':templateId')
  detail(
    @Param('templateId', ParseIntPipe) templateId: number,
  ): Promise<StructureTemplateDetail> {
    return this.templates.detail(templateId);
  }

  @Patch(':templateId')
  update(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: UpdateStructureTemplateDto,
  ): Promise<StructureTemplateDetail> {
    return this.templates.update(templateId, dto);
  }

  @Post(':templateId/activate')
  @HttpCode(200)
  activate(
    @Param('templateId', ParseIntPipe) templateId: number,
  ): Promise<StructureTemplateDetail> {
    return this.templates.activate(templateId);
  }

  @Post(':templateId/archive')
  @HttpCode(200)
  archive(
    @Param('templateId', ParseIntPipe) templateId: number,
  ): Promise<StructureTemplateDetail> {
    return this.templates.archive(templateId);
  }

  @Post(':templateId/nodes')
  createNode(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: CreateTemplateNodeDto,
  ): Promise<TemplateNode> {
    return this.templates.createNode(templateId, dto);
  }

  @Patch(':templateId/nodes/:nodeId')
  updateNode(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Body() dto: UpdateTemplateNodeDto,
  ): Promise<TemplateNode> {
    return this.templates.updateNode(templateId, nodeId, dto);
  }

  @Post(':templateId/nodes/:nodeId/move')
  @HttpCode(204)
  async moveNode(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Body() dto: MoveTemplateNodeDto,
  ): Promise<void> {
    await this.templates.moveNode(templateId, nodeId, dto);
  }

  @Put(':templateId/nodes/order')
  @HttpCode(204)
  async orderNodes(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: OrderTemplateNodesDto,
  ): Promise<void> {
    await this.templates.orderNodes(templateId, dto);
  }

  @Get(':templateId/nodes/:nodeId/deletion-preview')
  deletionPreview(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('nodeId', ParseIntPipe) nodeId: number,
  ): Promise<SubtreePreview> {
    return this.templates.deletionPreview(templateId, nodeId);
  }

  @Delete(':templateId/nodes/:nodeId')
  @HttpCode(204)
  async deleteNode(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Query('confirmed') confirmed?: string,
  ): Promise<void> {
    await this.templates.deleteNode(templateId, nodeId, confirmed === 'true');
  }
}
