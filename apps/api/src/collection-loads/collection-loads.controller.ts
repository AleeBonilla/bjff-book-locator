import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type {
  Carga,
  Paginado,
  ProblemaDeCarga,
  Registro,
  ResumenDeCarga,
} from '@bjff/api-types';
import type { Request } from 'express';

import { ApiError } from '../common/api-error.js';
import { logger } from '../common/logger.js';
import type { LoadErrorSeverity } from '../database/schema.types.js';
import {
  CollectionLoadsQueryService,
  normalizePage,
} from './collection-loads.query.service.js';
import { CollectionLoadsRepository } from './collection-loads.repository.js';
import { ImportService } from './import.service.js';

/** Recursos de `contracts/rest-api.md`. Todos exigen sesión (guarda global). */
@Controller('api/collection-loads')
export class CollectionLoadsController {
  constructor(
    private readonly imports: ImportService,
    private readonly queries: CollectionLoadsQueryService,
    private readonly repository: CollectionLoadsRepository,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Req() request: Request,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('title') title?: string,
  ): Promise<Carga> {
    if (!file || file.size === 0) throw ApiError.noFile();

    const filename = file.originalname || 'coleccion.csv';
    const row = await this.imports.import(
      file.buffer,
      filename,
      (title ?? '').trim() || filename,
      request.userId ?? null,
    );

    // Se relee para devolver la representación completa del contrato, con la persona
    // que creó la carga resuelta.
    return this.queries.detail(row.collection_load_id);
  }

  @Get()
  list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<Paginado<ResumenDeCarga>> {
    return this.queries.list(normalizePage(toInt(limit), toInt(offset)));
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number): Promise<Carga> {
    return this.queries.detail(id);
  }

  @Get(':id/errors')
  errors(
    @Param('id', ParseIntPipe) id: number,
    @Query('severity') severity?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<Paginado<ProblemaDeCarga>> {
    const parsed =
      severity === 'REVIEW' || severity === 'REJECTED'
        ? (severity as LoadErrorSeverity)
        : undefined;

    return this.queries.errors(id, normalizePage(toInt(limit), toInt(offset)), parsed);
  }

  /**
   * Elimina una carga con sus registros y sus problemas (FR-001 a FR-008).
   *
   * La confirmación es responsabilidad de la interfaz (FR-002): al llegar aquí, la
   * decisión ya se tomó y la operación no es reversible.
   */
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    // Falla con 404 si no existe, antes de intentar borrar nada (FR-006).
    const load = await this.queries.detail(id);

    await this.repository.remove(id);

    logger.info('load_deleted', {
      collectionLoadId: id,
      rowsRemoved: load.counters.rowsImported,
    });
  }

  @Get(':id/books')
  books(
    @Param('id', ParseIntPipe) id: number,
    @Query('withoutKey') withoutKey?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<Paginado<Registro>> {
    return this.queries.books(
      id,
      normalizePage(toInt(limit), toInt(offset)),
      withoutKey === 'true',
    );
  }
}

function toInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
