export type SchemeStatus =
  | 'DRAFT'
  | 'LEVELS_DEFINED'
  | 'LOCATIONS_DEFINED'
  | 'PARTIALLY_ASSIGNED'
  | 'ASSIGNED';

export type CloneScope = 'levels' | 'levels_and_locations' | 'all';

export interface ApiSuccess<T> {
  data: T;
}

export interface AdminErrorBody {
  code: string;
  message: string;
  details: string[];
}

export class AdminGatewayError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: string[];

  constructor(status: number, error: AdminErrorBody) {
    super(error.message);
    this.name = 'AdminGatewayError';
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

export interface SchemeLevel {
  id: string;
  key: string;
  parentKey: string | null;
  name: string;
  sortOrder: number;
  isSearchTerminal: boolean;
}

export interface Location {
  id: string;
  levelId: string;
  parentLocationId: string | null;
  name: string;
  ordinal: number;
  sortOrder: number;
  code: string;
  path: number[];
}

export interface LocationRange {
  locationId: string;
  rangeStart: string;
  rangeEnd: string;
}

export interface TopMap {
  id: string;
  name: string;
  svgName: string;
  source: string;
  representedLevelIds: string[];
  enabled: boolean;
}

export interface FrontMapVariant {
  id: string;
  name: string;
  variantCode: string;
  slotCount: number;
  source: string;
}

export interface FrontMapLayer {
  id: string;
  name: string;
  representedLevelId: string;
  enabled: boolean;
  variants: FrontMapVariant[];
  assignments: Record<string, string>;
}

export interface Scheme {
  id: string;
  name: string;
  shortDescription: string;
  status: SchemeStatus;
  isActive: boolean;
  publishedAt: string | null;
  updatedAt: string;
  orderingProfileCode: 'ddc-base-v1';
  levels: SchemeLevel[];
  locations: Location[];
  ranges: LocationRange[];
  topMaps: TopMap[];
  frontLayers: FrontMapLayer[];
}

export interface CreateSchemeInput {
  name: string;
  shortDescription?: string;
}

export interface UpdateSchemeInput {
  name?: string;
  shortDescription?: string;
}

export interface ReplaceLevelInput {
  key: string;
  parentKey: string | null;
  name: string;
  sortOrder: number;
  isSearchTerminal: boolean;
}

export interface AddLocationsInput {
  parentLocationId: string | null;
  quantity: number;
  schemeLevelId?: string;
}

export interface SaveRangeInput {
  locationId: string;
  rangeStart: string;
  rangeEnd: string;
}

export interface SaveTopMapInput {
  name: string;
  svgName: string;
  source: string;
  representedLevelIds: string[];
}

export interface SaveFrontVariantInput {
  layerId?: string;
  layerName: string;
  representedLevelId: string;
  variantName: string;
  variantCode: string;
  slotCount: number;
  source: string;
}

export interface MapValidation {
  ready: boolean;
  topCoveredLocationIds: string[];
  missingTopLocationIds: string[];
  frontWarnings: string[];
}

export interface SchemeReview {
  schemeId: string;
  levelCount: number;
  locationCount: number;
  terminalCount: number;
  assignedRangeCount: number;
  missingRangeLocationIds: string[];
  mapValidation: MapValidation;
  blockers: string[];
  publishable: boolean;
}

export interface SearchRouteItem {
  name: string;
  code: string;
}

export interface SearchMatch {
  locationId: string;
  name: string;
  code: string;
  rangeStart: string;
  rangeEnd: string;
  route: SearchRouteItem[];
}

export interface SearchTopView {
  name: string;
  source: string;
  highlightLocationCodes: string[];
}

export interface SearchFrontView {
  name: string;
  source: string;
  highlightSlots: number[];
}

export interface SearchTestResult {
  query: string;
  normalized: string;
  schemeId: string;
  schemeName: string;
  matches: SearchMatch[];
  maps: {
    topViews: SearchTopView[];
    frontViews: SearchFrontView[];
  };
}

export function statusLabel(status: SchemeStatus) {
  const labels: Record<SchemeStatus, string> = {
    DRAFT: 'Borrador',
    LEVELS_DEFINED: 'Niveles definidos',
    LOCATIONS_DEFINED: 'Ubicaciones definidas',
    PARTIALLY_ASSIGNED: 'Rangos parciales',
    ASSIGNED: 'Listo',
  };

  return labels[status];
}

export function terminalLevel(scheme: Scheme) {
  return scheme.levels.find((level) => level.isSearchTerminal) ?? null;
}

export function terminalLocations(scheme: Scheme) {
  const terminal = terminalLevel(scheme);
  return terminal
    ? scheme.locations.filter((location) => location.levelId === terminal.id)
    : [];
}

export function locationRoute(scheme: Scheme, location: Location) {
  const route: Location[] = [];
  let current: Location | undefined = location;

  while (current) {
    route.unshift(current);
    current = current.parentLocationId
      ? scheme.locations.find((candidate) => candidate.id === current?.parentLocationId)
      : undefined;
  }

  return route;
}

export function schemeCanUseMapsAndRanges(scheme: Scheme) {
  return ['LOCATIONS_DEFINED', 'PARTIALLY_ASSIGNED', 'ASSIGNED'].includes(scheme.status);
}
