import type {
  AddLocationsInput,
  ApiSuccess,
  CloneScope,
  CreateFrontLayerInput,
  CreateSchemeInput,
  DeleteSchemeResult,
  Location,
  LocationRange,
  MapUploadResult,
  MapValidation,
  ReplaceMapSvgInput,
  ReplaceLevelInput,
  SaveFrontVariantInput,
  SaveRangeInput,
  SaveTopMapInput,
  Scheme,
  SchemeReview,
  SearchTestResult,
  UpdateMapLayerInput,
  UpdateSchemeInput,
} from './types';

export interface AdminGateway {
  listSchemes(): Promise<ApiSuccess<Scheme[]>>;
  getScheme(schemeId: string): Promise<ApiSuccess<Scheme>>;
  createScheme(input: CreateSchemeInput): Promise<ApiSuccess<Scheme>>;
  updateScheme(schemeId: string, input: UpdateSchemeInput): Promise<ApiSuccess<Scheme>>;
  deleteScheme(schemeId: string): Promise<ApiSuccess<DeleteSchemeResult>>;
  cloneScheme(
    schemeId: string,
    input: { name: string; scope: CloneScope },
  ): Promise<ApiSuccess<Scheme>>;
  replaceLevels(schemeId: string, levels: ReplaceLevelInput[]): Promise<ApiSuccess<Scheme>>;
  confirmLevels(schemeId: string): Promise<ApiSuccess<Scheme>>;
  addLocations(schemeId: string, input: AddLocationsInput): Promise<ApiSuccess<Location[]>>;
  deleteLocation(schemeId: string, locationId: string): Promise<ApiSuccess<null>>;
  confirmLocations(schemeId: string): Promise<ApiSuccess<Scheme>>;
  reopenLevels(schemeId: string, confirmDataLoss: true): Promise<ApiSuccess<Scheme>>;
  reopenLocations(schemeId: string, confirmDataLoss: true): Promise<ApiSuccess<Scheme>>;
  saveRange(schemeId: string, input: SaveRangeInput): Promise<ApiSuccess<LocationRange[]>>;
  saveRanges(schemeId: string, items: SaveRangeInput[]): Promise<ApiSuccess<LocationRange[]>>;
  deleteRange(schemeId: string, locationId: string): Promise<ApiSuccess<null>>;
  saveTopMap(schemeId: string, input: SaveTopMapInput): Promise<ApiSuccess<MapUploadResult>>;
  updateMapLayer(
    schemeId: string,
    layerId: string,
    input: UpdateMapLayerInput,
  ): Promise<ApiSuccess<null>>;
  deleteTopMap(schemeId: string, mapId: string): Promise<ApiSuccess<null>>;
  createFrontLayer(
    schemeId: string,
    input: CreateFrontLayerInput,
  ): Promise<ApiSuccess<{ mapLayerId: string }>>;
  saveFrontVariant(schemeId: string, input: SaveFrontVariantInput): Promise<ApiSuccess<MapUploadResult>>;
  replaceMapSvg(
    schemeId: string,
    svgId: string,
    input: ReplaceMapSvgInput,
  ): Promise<ApiSuccess<MapUploadResult>>;
  deleteMapSvg(schemeId: string, svgId: string): Promise<ApiSuccess<null>>;
  assignFrontVariant(
    schemeId: string,
    layerId: string,
    contextLocationId: string,
    variantId: string | null,
  ): Promise<ApiSuccess<null>>;
  deleteFrontLayer(schemeId: string, layerId: string): Promise<ApiSuccess<null>>;
  setDrilldown(
    schemeId: string,
    topLayerId: string,
    schemeLevelId: string,
    frontLayerId: string | null,
  ): Promise<ApiSuccess<null>>;
  validateMaps(schemeId: string): Promise<ApiSuccess<MapValidation>>;
  reviewScheme(schemeId: string): Promise<ApiSuccess<SchemeReview>>;
  publishScheme(schemeId: string, activate: boolean): Promise<ApiSuccess<Scheme>>;
  activateScheme(schemeId: string): Promise<ApiSuccess<Scheme>>;
  searchTests(schemeId: string, callNumber: string): Promise<ApiSuccess<SearchTestResult>>;
  exportLocationsCsv(schemeId: string, levelId?: string): Promise<ApiSuccess<string>>;
}
