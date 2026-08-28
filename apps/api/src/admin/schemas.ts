import { z } from 'zod';

export const schemeIdParamsSchema = z.object({
  schemeId: z.coerce.number().int().positive(),
});

export const locationParamsSchema = schemeIdParamsSchema.extend({
  locationId: z.coerce.number().int().positive(),
});

export const layerParamsSchema = schemeIdParamsSchema.extend({
  layerId: z.coerce.number().int().positive(),
});

export const drilldownParamsSchema = layerParamsSchema.extend({
  schemeLevelId: z.coerce.number().int().positive(),
});

export const assignmentParamsSchema = layerParamsSchema.extend({
  contextLocationId: z.coerce.number().int().positive(),
});

export const svgParamsSchema = schemeIdParamsSchema.extend({
  svgId: z.coerce.number().int().positive(),
});

export const createSchemeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  shortDescription: z.string().trim().max(255).nullable().optional(),
});

export const updateSchemeSchema = createSchemeSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  'Debe indicar al menos un campo.',
);

export const levelInputSchema = z.object({
  key: z.string().trim().min(1).max(80),
  parentKey: z.string().trim().min(1).max(80).nullable(),
  name: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().min(0).max(32_767),
  isSearchTerminal: z.boolean(),
});

export const replaceLevelsSchema = z.object({
  levels: z.array(levelInputSchema).min(1).max(30),
});

export const addLocationsSchema = z.object({
  parentLocationId: z.number().int().positive().nullable(),
  schemeLevelId: z.number().int().positive().optional(),
  quantity: z.number().int().min(1).max(50),
});

export const locationCsvQuerySchema = z.object({
  levelId: z.coerce.number().int().positive().optional(),
});

export const destructiveResetSchema = z.object({
  confirmDataLoss: z.literal(true),
});

export const rangeInputSchema = z.object({
  rangeStart: z.string().trim().min(1).max(120),
  rangeEnd: z.string().trim().min(1).max(120),
});

export const bulkRangesSchema = z.object({
  items: z.array(rangeInputSchema.extend({
    locationId: z.number().int().positive(),
  })).min(1).max(5_000),
});

export const cloneSchemeSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scope: z.enum(['levels', 'levels_and_locations', 'all']),
});

export const publishSchema = z.object({
  activate: z.boolean().default(false),
});

export const searchTestSchema = z.object({
  callNumber: z.string().trim().min(1).max(512),
});

export const createFrontLayerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  representedLevelId: z.number().int().positive(),
});

export const updateMapLayerSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  enabled: z.boolean().optional(),
}).refine(
  (value) => Object.keys(value).length > 0,
  'Debe indicar al menos un campo.',
);

export const assignmentSchema = z.object({
  mapLayerSvgId: z.number().int().positive().nullable(),
});

export const drilldownSchema = z.object({
  frontLayerId: z.number().int().positive().nullable(),
});

export const topMapMetadataSchema = z.object({
  name: z.string().trim().min(1).max(120),
  svgName: z.string().trim().min(1).max(120),
  representedLevelIds: z.array(z.number().int().positive()).min(1).max(30),
});

export const frontVariantMetadataSchema = z.object({
  name: z.string().trim().min(1).max(120),
  variantCode: z.string().trim().min(1).max(60),
  slotCount: z.number().int().min(1).max(32_767),
});

export const replaceSvgMetadataSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  variantCode: z.string().trim().min(1).max(60).optional(),
  slotCount: z.number().int().min(1).max(32_767).optional(),
  enabled: z.boolean().optional(),
});
