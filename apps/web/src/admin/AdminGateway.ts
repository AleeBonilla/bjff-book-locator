import type {
  AddLocationsInput,
  ApiSuccess,
  CloneScope,
  CreateSchemeInput,
  Location,
  LocationRange,
  MapValidation,
  ReplaceLevelInput,
  SaveFrontVariantInput,
  SaveRangeInput,
  SaveTopMapInput,
  Scheme,
  SchemeReview,
  SearchTestResult,
  UpdateSchemeInput,
} from './types';

export interface AdminGateway {
  listSchemes(): Promise<ApiSuccess<Scheme[]>>;
  getScheme(schemeId: string): Promise<ApiSuccess<Scheme>>;
  createScheme(input: CreateSchemeInput): Promise<ApiSuccess<Scheme>>;
  updateScheme(schemeId: string, input: UpdateSchemeInput): Promise<ApiSuccess<Scheme>>;
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
  saveRange(schemeId: string, input: SaveRangeInput): Promise<ApiSuccess<LocationRange>>;
  saveRanges(schemeId: string, items: SaveRangeInput[]): Promise<ApiSuccess<LocationRange[]>>;
  deleteRange(schemeId: string, locationId: string): Promise<ApiSuccess<null>>;
  saveTopMap(schemeId: string, input: SaveTopMapInput): Promise<ApiSuccess<Scheme>>;
  deleteTopMap(schemeId: string, mapId: string): Promise<ApiSuccess<null>>;
  saveFrontVariant(schemeId: string, input: SaveFrontVariantInput): Promise<ApiSuccess<Scheme>>;
  assignFrontVariant(
    schemeId: string,
    layerId: string,
    contextLocationId: string,
    variantId: string | null,
  ): Promise<ApiSuccess<Scheme>>;
  deleteFrontLayer(schemeId: string, layerId: string): Promise<ApiSuccess<null>>;
  validateMaps(schemeId: string): Promise<ApiSuccess<MapValidation>>;
  reviewScheme(schemeId: string): Promise<ApiSuccess<SchemeReview>>;
  publishScheme(schemeId: string, activate: boolean): Promise<ApiSuccess<Scheme>>;
  activateScheme(schemeId: string): Promise<ApiSuccess<Scheme>>;
  searchTests(schemeId: string, callNumber: string): Promise<ApiSuccess<SearchTestResult>>;
  exportLocationsCsv(schemeId: string): Promise<ApiSuccess<string>>;
}
