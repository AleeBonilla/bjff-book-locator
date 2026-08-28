import { Router } from 'express';
import multer from 'multer';
import type { Pool } from 'pg';
import { z } from 'zod';

import { ApiError } from '../errors.js';
import { MapService } from '../maps/map-service.js';
import type { SvgStorage } from '../maps/storage.js';
import { resolveActor } from './actor.js';
import {
  addLocationsSchema,
  assignmentParamsSchema,
  assignmentSchema,
  bulkRangesSchema,
  cloneSchemeSchema,
  createFrontLayerSchema,
  createSchemeSchema,
  destructiveResetSchema,
  drilldownParamsSchema,
  drilldownSchema,
  frontVariantMetadataSchema,
  layerParamsSchema,
  locationCsvQuerySchema,
  locationParamsSchema,
  publishSchema,
  rangeInputSchema,
  replaceLevelsSchema,
  replaceSvgMetadataSchema,
  schemeIdParamsSchema,
  searchTestSchema,
  svgParamsSchema,
  topMapMetadataSchema,
  updateMapLayerSchema,
  updateSchemeSchema,
} from './schemas.js';
import { SchemeService } from './scheme-service.js';

interface AdminRouterOptions {
  pool: Pool;
  storage: SvgStorage;
  actorUsername: string;
  allowUnauthenticated: boolean;
  maxSvgUploadBytes: number;
}

function parseMetadata<T>(raw: unknown, schema: z.ZodType<T>): T {
  if (typeof raw !== 'string') {
    throw new ApiError(400, 'MISSING_UPLOAD_METADATA', 'La carga requiere el campo metadata.');
  }
  try {
    return schema.parse(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError(400, 'INVALID_UPLOAD_METADATA', 'El campo metadata no contiene JSON válido.');
    }
    throw error;
  }
}

function requireSvg(file: Express.Multer.File | undefined): string {
  if (file === undefined) {
    throw new ApiError(400, 'SVG_FILE_REQUIRED', 'Debe adjuntar un archivo en el campo svg.');
  }
  return file.buffer.toString('utf8');
}

export function createAdminRouter(options: AdminRouterOptions): Router {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.maxSvgUploadBytes, files: 1 },
  });
  const schemes = new SchemeService(options.pool);
  const maps = new MapService(options.pool, options.storage);
  let actorPromise: ReturnType<typeof resolveActor> | undefined;
  const getActor = () => {
    actorPromise ??= resolveActor(options.pool, options.actorUsername);
    return actorPromise;
  };

  router.use((_request, _response, next) => {
    if (!options.allowUnauthenticated) {
      next(new ApiError(503, 'ADMIN_AUTHENTICATION_NOT_IMPLEMENTED', 'El acceso administrativo requiere autenticación.'));
      return;
    }
    next();
  });

  router.get('/schemes', async (_request, response) => {
    response.json({ data: await schemes.listSchemes() });
  });

  router.post('/schemes', async (request, response) => {
    const input = createSchemeSchema.parse(request.body);
    response.status(201).json({ data: await schemes.createScheme((await getActor()).userId, input) });
  });

  router.get('/schemes/:schemeId', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await schemes.getSchemeDetail(schemeId) });
  });

  router.patch('/schemes/:schemeId', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await schemes.updateScheme(schemeId, updateSchemeSchema.parse(request.body)) });
  });

  router.delete('/schemes/:schemeId', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    destructiveResetSchema.parse(request.body);
    response.json({ data: await maps.deleteScheme(schemeId) });
  });

  router.post('/schemes/:schemeId/clone', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    const input = cloneSchemeSchema.parse(request.body);
    response.status(201).json({ data: await maps.cloneScheme(schemeId, (await getActor()).userId, input) });
  });

  router.get('/schemes/:schemeId/levels', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await schemes.getLevels(schemeId) });
  });

  router.put('/schemes/:schemeId/levels', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    const { levels } = replaceLevelsSchema.parse(request.body);
    response.json({ data: await schemes.replaceLevels(schemeId, levels) });
  });

  router.post('/schemes/:schemeId/levels/confirm', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await schemes.confirmLevels(schemeId, (await getActor()).userId) });
  });

  router.get('/schemes/:schemeId/locations', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await schemes.getLocations(schemeId) });
  });

  router.post('/schemes/:schemeId/locations', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    const input = addLocationsSchema.parse(request.body);
    response.status(201).json({ data: await schemes.addLocations(schemeId, (await getActor()).userId, input) });
  });

  router.delete('/schemes/:schemeId/locations/:locationId', async (request, response) => {
    const { schemeId, locationId } = locationParamsSchema.parse(request.params);
    response.json({ data: await schemes.deleteLocation(schemeId, locationId) });
  });

  router.post('/schemes/:schemeId/locations/confirm', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await schemes.confirmLocations(schemeId) });
  });

  router.post('/schemes/:schemeId/actions/reopen-locations', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    destructiveResetSchema.parse(request.body);
    const assets = await maps.getAssetUrls(schemeId);
    const result = await schemes.reopenLocations(schemeId);
    await maps.removeAssetsBestEffort(assets);
    response.json({ data: result });
  });

  router.post('/schemes/:schemeId/actions/reopen-levels', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    destructiveResetSchema.parse(request.body);
    const assets = await maps.getAssetUrls(schemeId);
    const result = await schemes.reopenLevels(schemeId);
    await maps.removeAssetsBestEffort(assets);
    response.json({ data: result });
  });

  router.get('/schemes/:schemeId/locations.csv', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    const { levelId } = locationCsvQuerySchema.parse(request.query);
    const csv = await schemes.exportLocationsCsv(schemeId, levelId);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="ubicaciones-esquema-${schemeId}.csv"`);
    response.send(csv);
  });

  router.get('/schemes/:schemeId/ranges', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await schemes.getRanges(schemeId) });
  });

  router.put('/schemes/:schemeId/ranges', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    const { items } = bulkRangesSchema.parse(request.body);
    response.json({ data: await schemes.setRanges(schemeId, (await getActor()).userId, items) });
  });

  router.put('/schemes/:schemeId/ranges/:locationId', async (request, response) => {
    const { schemeId, locationId } = locationParamsSchema.parse(request.params);
    const input = rangeInputSchema.parse(request.body);
    response.json({ data: await schemes.setRange(schemeId, locationId, (await getActor()).userId, input) });
  });

  router.delete('/schemes/:schemeId/ranges/:locationId', async (request, response) => {
    const { schemeId, locationId } = locationParamsSchema.parse(request.params);
    response.json({ data: await schemes.deleteRange(schemeId, locationId, (await getActor()).userId) });
  });

  router.get('/schemes/:schemeId/maps', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await maps.getMaps(schemeId) });
  });

  router.post('/schemes/:schemeId/maps/top', upload.single('svg'), async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    const metadata = parseMetadata(request.body.metadata, topMapMetadataSchema);
    response.status(201).json({ data: await maps.createTopLayer(schemeId, metadata, requireSvg(request.file)) });
  });

  router.post('/schemes/:schemeId/maps/front', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.status(201).json({ data: await maps.createFrontLayer(schemeId, createFrontLayerSchema.parse(request.body)) });
  });

  router.post('/schemes/:schemeId/maps/front/:layerId/variants', upload.single('svg'), async (request, response) => {
    const { schemeId, layerId } = layerParamsSchema.parse(request.params);
    const metadata = parseMetadata(request.body.metadata, frontVariantMetadataSchema);
    response.status(201).json({ data: await maps.addFrontVariant(schemeId, layerId, metadata, requireSvg(request.file)) });
  });

  router.put('/schemes/:schemeId/maps/svgs/:svgId', upload.single('svg'), async (request, response) => {
    const { schemeId, svgId } = svgParamsSchema.parse(request.params);
    const metadata = parseMetadata(request.body.metadata, replaceSvgMetadataSchema);
    const rawSvg = request.file?.buffer.toString('utf8');
    response.json({ data: await maps.replaceSvg(schemeId, svgId, metadata, rawSvg) });
  });

  router.delete('/schemes/:schemeId/maps/svgs/:svgId', async (request, response) => {
    const { schemeId, svgId } = svgParamsSchema.parse(request.params);
    response.json({ data: await maps.deleteSvg(schemeId, svgId) });
  });

  router.delete('/schemes/:schemeId/maps/layers/:layerId', async (request, response) => {
    const { schemeId, layerId } = layerParamsSchema.parse(request.params);
    response.json({ data: await maps.deleteLayer(schemeId, layerId) });
  });

  router.patch('/schemes/:schemeId/maps/layers/:layerId', async (request, response) => {
    const { schemeId, layerId } = layerParamsSchema.parse(request.params);
    response.json({ data: await maps.updateLayer(schemeId, layerId, updateMapLayerSchema.parse(request.body)) });
  });

  router.put('/schemes/:schemeId/maps/layers/:layerId/assignments/:contextLocationId', async (request, response) => {
    const { schemeId, layerId, contextLocationId } = assignmentParamsSchema.parse(request.params);
    const { mapLayerSvgId } = assignmentSchema.parse(request.body);
    response.json({ data: await maps.setAssignment(schemeId, layerId, contextLocationId, mapLayerSvgId) });
  });

  router.put('/schemes/:schemeId/maps/layers/:layerId/drilldowns/:schemeLevelId', async (request, response) => {
    const { schemeId, layerId, schemeLevelId } = drilldownParamsSchema.parse(request.params);
    const { frontLayerId } = drilldownSchema.parse(request.body);
    response.json({ data: await maps.setDrilldown(schemeId, layerId, schemeLevelId, frontLayerId) });
  });

  router.post('/schemes/:schemeId/maps/validate', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await maps.validateMaps(schemeId) });
  });

  router.get('/schemes/:schemeId/review', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await maps.review(schemeId) });
  });

  router.post('/schemes/:schemeId/publish', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    const { activate } = publishSchema.parse(request.body);
    response.json({ data: await maps.publish(schemeId, (await getActor()).userId, activate) });
  });

  router.post('/schemes/:schemeId/activate', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    response.json({ data: await maps.activate(schemeId) });
  });

  router.post('/schemes/:schemeId/search-tests', async (request, response) => {
    const { schemeId } = schemeIdParamsSchema.parse(request.params);
    const { callNumber } = searchTestSchema.parse(request.body);
    const result = await schemes.searchText(schemeId, callNumber);
    const mapResult = await maps.searchVisuals(schemeId, result.matches);
    response.json({ data: { ...result, maps: mapResult } });
  });

  return router;
}
