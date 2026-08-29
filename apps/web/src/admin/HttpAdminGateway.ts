import type { AdminGateway } from './AdminGateway';
import {
  AdminGatewayError,
  type AddLocationsInput,
  type ApiSuccess,
  type CreateFrontLayerInput,
  type CreateSchemeInput,
  type DeleteSchemeResult,
  type FrontMapLayer,
  type Location,
  type LocationRange,
  type MapBlocker,
  type MapUploadResult,
  type MapValidation,
  type ReplaceLevelInput,
  type ReplaceMapSvgInput,
  type SaveFrontVariantInput,
  type SaveRangeInput,
  type SaveTopMapInput,
  type Scheme,
  type SchemeLevel,
  type SchemeReview,
  type SchemeStatus,
  type SearchTestResult,
  type TopMap,
  type UpdateMapLayerInput,
  type UpdateSchemeInput,
} from './types';

interface WireScheme {
  schemeId: number;
  name: string;
  status: SchemeStatus;
  shortDescription: string | null;
  isActive: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

interface WireLevel {
  schemeLevelId: number;
  parentLevelId: number | null;
  name: string;
  sortOrder: number;
  isSearchTerminal: boolean;
}

interface WireLocation {
  locationId: number;
  parentLocationId: number | null;
  schemeLevelId: number;
  name: string;
  code: string;
  sortOrder: number;
  range: { start: string; end: string } | null;
}

interface WireSchemeDetail extends WireScheme {
  levels: WireLevel[];
  locations: WireLocation[];
}

interface WireMapSvg {
  mapLayerSvgId: number;
  name: string;
  variantCode: string | null;
  assetUrl: string;
  slotCount: number | null;
  enabled: boolean;
}

interface WireMapLayer {
  mapLayerId: number;
  name: string;
  viewType: 'TOP' | 'FRONT';
  renderMode: 'STATIC' | 'TEMPLATE';
  enabled: boolean;
  representedLevels: Array<{
    schemeLevelId: number;
    drilldownMapLayerId: number | null;
  }>;
  svgs: WireMapSvg[];
  assignments: Array<{
    mapLayerSvgId: number;
    contextLocationId: number;
  }>;
}

interface WireMapUpload {
  mapLayerId?: number;
  mapLayerSvgId?: number;
  map_layer_svg_id?: number;
  assetUrl?: string;
  asset_url?: string;
  removedItems: number;
}

interface WireReview {
  scheme: WireScheme;
  counts: {
    levels: number;
    locations: number;
    terminalLocations: number;
    assignedRanges: number;
  };
  ranges: { complete: boolean; missingLocationCodes: string[] };
  maps: MapValidation;
  blockers: MapBlocker[];
  publishable: boolean;
}

interface WireNormalization {
  prefix: string | null;
  ddc: { canonical: string };
  cutter: { letters: string; digits: string } | null;
  workmark: { segments: string[] } | null;
  additional_components: Array<{ value: string }>;
}

interface WireSearchResult {
  scheme: WireScheme;
  query: {
    raw: string;
    normalized: WireNormalization;
  };
  matches: Array<WireLocation & { route: WireLocation[] }>;
  maps: {
    topViews: Array<{
      mapLayerId: number;
      name: string;
      assetUrl: string;
      highlightLocationCodes: string[];
    }>;
    frontViews: Array<{
      mapLayerId: number;
      mapLayerSvgId: number;
      contextLocationId: number;
      name: string;
      assetUrl: string;
      highlightSlots: number[];
    }>;
  };
}

function levelDto(level: WireLevel): SchemeLevel {
  return {
    id: String(level.schemeLevelId),
    key: String(level.schemeLevelId),
    parentKey: level.parentLevelId === null ? null : String(level.parentLevelId),
    name: level.name,
    sortOrder: level.sortOrder,
    isSearchTerminal: level.isSearchTerminal,
  };
}

function locationDtos(rows: WireLocation[]): Location[] {
  const mapped = rows.map((row) => ({
    id: String(row.locationId),
    levelId: String(row.schemeLevelId),
    parentLocationId: row.parentLocationId === null ? null : String(row.parentLocationId),
    name: row.name,
    ordinal: row.sortOrder,
    sortOrder: row.sortOrder,
    code: row.code,
    path: [] as number[],
  }));
  const byId = new Map(mapped.map((location) => [location.id, location]));
  const pathFor = (location: Location) => {
    const path: number[] = [];
    const visited = new Set<string>();
    let current: Location | undefined = location;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current.sortOrder);
      current = current.parentLocationId ? byId.get(current.parentLocationId) : undefined;
    }
    return path;
  };
  return mapped.map((location) => ({ ...location, path: pathFor(location) }));
}

function baseScheme(scheme: WireScheme): Scheme {
  return {
    id: String(scheme.schemeId),
    name: scheme.name,
    shortDescription: scheme.shortDescription ?? '',
    status: scheme.status,
    isActive: scheme.isActive,
    publishedAt: scheme.publishedAt,
    updatedAt: scheme.updatedAt,
    orderingProfileCode: 'ddc-base-v1',
    levels: [],
    locations: [],
    ranges: [],
    topMaps: [],
    frontLayers: [],
  };
}

function mapSnapshot(layers: WireMapLayer[]): { topMaps: TopMap[]; frontLayers: FrontMapLayer[] } {
  const topMaps = layers.filter((layer) => layer.viewType === 'TOP').map<TopMap>((layer) => {
    const svg = layer.svgs.find((candidate) => candidate.enabled) ?? layer.svgs[0];
    return {
      id: String(layer.mapLayerId),
      svgId: svg ? String(svg.mapLayerSvgId) : null,
      name: layer.name,
      svgName: svg?.name ?? 'Sin archivo',
      assetUrl: svg?.assetUrl ?? null,
      representedLevelIds: layer.representedLevels.map((item) => String(item.schemeLevelId)),
      drilldowns: Object.fromEntries(layer.representedLevels.map((item) => [
        String(item.schemeLevelId),
        item.drilldownMapLayerId === null ? null : String(item.drilldownMapLayerId),
      ])),
      enabled: layer.enabled,
      svgEnabled: svg?.enabled ?? false,
    };
  });
  const frontLayers = layers.filter((layer) => layer.viewType === 'FRONT').map<FrontMapLayer>((layer) => ({
    id: String(layer.mapLayerId),
    name: layer.name,
    representedLevelId: String(layer.representedLevels[0]?.schemeLevelId ?? ''),
    enabled: layer.enabled,
    variants: layer.svgs.map((svg) => ({
      id: String(svg.mapLayerSvgId),
      name: svg.name,
      variantCode: svg.variantCode ?? '',
      slotCount: svg.slotCount ?? 0,
      assetUrl: svg.assetUrl,
      enabled: svg.enabled,
    })),
    assignments: Object.fromEntries(layer.assignments.map((assignment) => [
      String(assignment.contextLocationId),
      String(assignment.mapLayerSvgId),
    ])),
  }));
  return { topMaps, frontLayers };
}

function uploadDto(upload: WireMapUpload): MapUploadResult {
  const svgId = upload.mapLayerSvgId ?? upload.map_layer_svg_id;
  const assetUrl = upload.assetUrl ?? upload.asset_url;
  if (svgId === undefined || assetUrl === undefined) {
    throw new AdminGatewayError(500, {
      code: 'INVALID_API_RESPONSE',
      message: 'La API devolvió una respuesta de mapa incompleta.',
      details: [],
    });
  }
  return {
    ...(upload.mapLayerId === undefined ? {} : { mapLayerId: String(upload.mapLayerId) }),
    mapLayerSvgId: String(svgId),
    assetUrl,
    removedItems: upload.removedItems,
  };
}

function formatNormalization(value: WireNormalization): string {
  return [
    value.prefix,
    value.ddc.canonical,
    value.cutter ? `${value.cutter.letters}${value.cutter.digits}` : null,
    value.workmark?.segments.join('-') ?? null,
    ...value.additional_components.map((component) => component.value),
  ].filter((part): part is string => Boolean(part)).join(' ');
}

export class HttpAdminGateway implements AdminGateway {
  constructor(private readonly baseUrl = '') {}

  private url(path: string) {
    return `${this.baseUrl}/api/admin${path}`;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<ApiSuccess<T>> {
    let response: Response;
    try {
      response = await fetch(this.url(path), init);
    } catch {
      throw new AdminGatewayError(0, {
        code: 'API_UNAVAILABLE',
        message: 'No se pudo conectar con la API. Comprueba que el backend y PostgreSQL estén activos.',
        details: [],
      });
    }

    if (!response.ok) {
      const fallback = {
        code: 'REQUEST_FAILED',
        message: `La solicitud no se pudo completar (${response.status}).`,
        details: [],
      };
      const body = await response.json().catch(() => null) as { error?: typeof fallback } | null;
      throw new AdminGatewayError(response.status, body?.error ?? fallback);
    }

    return await response.json() as ApiSuccess<T>;
  }

  private json(method: string, body?: unknown): RequestInit {
    return {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    };
  }

  private async requestText(path: string, fallbackCode: string) {
    let response: Response;
    try {
      response = await fetch(this.url(path));
    } catch {
      throw new AdminGatewayError(0, {
        code: 'API_UNAVAILABLE',
        message: 'No se pudo conectar con la API. Comprueba que el backend y PostgreSQL estén activos.',
        details: [],
      });
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { code: string; message: string; details: unknown[] } } | null;
      throw new AdminGatewayError(response.status, body?.error ?? {
        code: fallbackCode, message: 'No se pudo generar el archivo.', details: [],
      });
    }
    return { data: await response.text() };
  }

  async listSchemes() {
    const response = await this.request<WireScheme[]>('/schemes');
    return { data: response.data.map(baseScheme) };
  }

  async getScheme(schemeId: string) {
    const encoded = encodeURIComponent(schemeId);
    const [detailResponse, mapsResponse] = await Promise.all([
      this.request<WireSchemeDetail>(`/schemes/${encoded}`),
      this.request<WireMapLayer[]>(`/schemes/${encoded}/maps`),
    ]);
    const detail = detailResponse.data;
    const maps = mapSnapshot(mapsResponse.data);
    return {
      data: {
        ...baseScheme(detail),
        levels: detail.levels.map(levelDto),
        locations: locationDtos(detail.locations),
        ranges: detail.locations.flatMap<LocationRange>((location) => location.range === null ? [] : [{
          locationId: String(location.locationId),
          rangeStart: location.range.start,
          rangeEnd: location.range.end,
        }]),
        ...maps,
      },
    };
  }

  async createScheme(input: CreateSchemeInput) {
    const response = await this.request<WireScheme>('/schemes', this.json('POST', input));
    return { data: baseScheme(response.data) };
  }

  async updateScheme(schemeId: string, input: UpdateSchemeInput) {
    const response = await this.request<WireScheme>(`/schemes/${encodeURIComponent(schemeId)}`, this.json('PATCH', input));
    return { data: baseScheme(response.data) };
  }

  async deleteScheme(schemeId: string) {
    const response = await this.request<Omit<DeleteSchemeResult, 'schemeId'> & { schemeId: number }>(
      `/schemes/${encodeURIComponent(schemeId)}`,
      this.json('DELETE', { confirmDataLoss: true }),
    );
    return { data: { ...response.data, schemeId: String(response.data.schemeId) } };
  }

  async cloneScheme(schemeId: string, input: { name: string; scope: 'levels' | 'levels_and_locations' | 'all' }) {
    const response = await this.request<WireScheme>(`/schemes/${encodeURIComponent(schemeId)}/clone`, this.json('POST', input));
    return { data: baseScheme(response.data) };
  }

  async replaceLevels(schemeId: string, levels: ReplaceLevelInput[]) {
    await this.request<WireLevel[]>(`/schemes/${encodeURIComponent(schemeId)}/levels`, this.json('PUT', { levels }));
    return this.getScheme(schemeId);
  }

  async confirmLevels(schemeId: string) {
    const response = await this.request<WireScheme>(`/schemes/${encodeURIComponent(schemeId)}/levels/confirm`, this.json('POST'));
    return { data: baseScheme(response.data) };
  }

  async addLocations(schemeId: string, input: AddLocationsInput) {
    const response = await this.request<WireLocation[]>(`/schemes/${encodeURIComponent(schemeId)}/locations`, this.json('POST', {
      ...input,
      parentLocationId: input.parentLocationId === null ? null : Number(input.parentLocationId),
      ...(input.schemeLevelId === undefined ? {} : { schemeLevelId: Number(input.schemeLevelId) }),
    }));
    return { data: locationDtos(response.data) };
  }

  async deleteLocation(schemeId: string, locationId: string) {
    await this.request(`/schemes/${encodeURIComponent(schemeId)}/locations/${encodeURIComponent(locationId)}`, this.json('DELETE'));
    return { data: null };
  }

  async confirmLocations(schemeId: string) {
    const response = await this.request<WireScheme>(`/schemes/${encodeURIComponent(schemeId)}/locations/confirm`, this.json('POST'));
    return { data: baseScheme(response.data) };
  }

  async reopenLevels(schemeId: string, confirmDataLoss: true) {
    const response = await this.request<WireScheme>(`/schemes/${encodeURIComponent(schemeId)}/actions/reopen-levels`, this.json('POST', { confirmDataLoss }));
    return { data: baseScheme(response.data) };
  }

  async reopenLocations(schemeId: string, confirmDataLoss: true) {
    const response = await this.request<WireScheme>(`/schemes/${encodeURIComponent(schemeId)}/actions/reopen-locations`, this.json('POST', { confirmDataLoss }));
    return { data: baseScheme(response.data) };
  }

  private rangesFrom(rows: WireLocation[]): LocationRange[] {
    return rows.flatMap((location) => location.range === null ? [] : [{
      locationId: String(location.locationId),
      rangeStart: location.range.start,
      rangeEnd: location.range.end,
    }]);
  }

  async saveRange(schemeId: string, input: SaveRangeInput) {
    const response = await this.request<WireLocation[]>(
      `/schemes/${encodeURIComponent(schemeId)}/ranges/${encodeURIComponent(input.locationId)}`,
      this.json('PUT', { rangeStart: input.rangeStart, rangeEnd: input.rangeEnd }),
    );
    return { data: this.rangesFrom(response.data) };
  }

  async saveRanges(schemeId: string, items: SaveRangeInput[]) {
    const response = await this.request<WireLocation[]>(`/schemes/${encodeURIComponent(schemeId)}/ranges`, this.json('PUT', {
      items: items.map((item) => ({ ...item, locationId: Number(item.locationId) })),
    }));
    return { data: this.rangesFrom(response.data) };
  }

  async deleteRange(schemeId: string, locationId: string) {
    await this.request(`/schemes/${encodeURIComponent(schemeId)}/ranges/${encodeURIComponent(locationId)}`, this.json('DELETE'));
    return { data: null };
  }

  async saveTopMap(schemeId: string, input: SaveTopMapInput) {
    const form = new FormData();
    form.append('metadata', JSON.stringify({
      name: input.name,
      svgName: input.svgName,
      representedLevelIds: input.representedLevelIds.map(Number),
    }));
    form.append('svg', input.file, input.file.name);
    const response = await this.request<WireMapUpload>(`/schemes/${encodeURIComponent(schemeId)}/maps/top`, {
      method: 'POST',
      body: form,
    });
    return { data: uploadDto(response.data) };
  }

  async updateMapLayer(schemeId: string, layerId: string, input: UpdateMapLayerInput) {
    await this.request(`/schemes/${encodeURIComponent(schemeId)}/maps/layers/${encodeURIComponent(layerId)}`, this.json('PATCH', input));
    return { data: null };
  }

  async deleteTopMap(schemeId: string, mapId: string) {
    await this.request(`/schemes/${encodeURIComponent(schemeId)}/maps/layers/${encodeURIComponent(mapId)}`, this.json('DELETE'));
    return { data: null };
  }

  async createFrontLayer(schemeId: string, input: CreateFrontLayerInput) {
    const response = await this.request<{ mapLayerId: number }>(`/schemes/${encodeURIComponent(schemeId)}/maps/front`, this.json('POST', {
      name: input.name,
      representedLevelId: Number(input.representedLevelId),
    }));
    return { data: { mapLayerId: String(response.data.mapLayerId) } };
  }

  async saveFrontVariant(schemeId: string, input: SaveFrontVariantInput) {
    const form = new FormData();
    form.append('metadata', JSON.stringify({
      name: input.variantName,
      variantCode: input.variantCode,
      slotCount: input.slotCount,
    }));
    form.append('svg', input.file, input.file.name);
    const response = await this.request<WireMapUpload>(
      `/schemes/${encodeURIComponent(schemeId)}/maps/front/${encodeURIComponent(input.layerId)}/variants`,
      { method: 'POST', body: form },
    );
    return { data: uploadDto(response.data) };
  }

  async replaceMapSvg(schemeId: string, svgId: string, input: ReplaceMapSvgInput) {
    const form = new FormData();
    const metadata = {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.variantCode === undefined ? {} : { variantCode: input.variantCode }),
      ...(input.slotCount === undefined ? {} : { slotCount: input.slotCount }),
      ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
    };
    form.append('metadata', JSON.stringify(metadata));
    if (input.file) form.append('svg', input.file, input.file.name);
    const response = await this.request<WireMapUpload>(
      `/schemes/${encodeURIComponent(schemeId)}/maps/svgs/${encodeURIComponent(svgId)}`,
      { method: 'PUT', body: form },
    );
    return { data: uploadDto(response.data) };
  }

  async deleteMapSvg(schemeId: string, svgId: string) {
    await this.request(`/schemes/${encodeURIComponent(schemeId)}/maps/svgs/${encodeURIComponent(svgId)}`, this.json('DELETE'));
    return { data: null };
  }

  async assignFrontVariant(schemeId: string, layerId: string, contextLocationId: string, variantId: string | null) {
    await this.request(
      `/schemes/${encodeURIComponent(schemeId)}/maps/layers/${encodeURIComponent(layerId)}/assignments/${encodeURIComponent(contextLocationId)}`,
      this.json('PUT', { mapLayerSvgId: variantId === null ? null : Number(variantId) }),
    );
    return { data: null };
  }

  async deleteFrontLayer(schemeId: string, layerId: string) {
    await this.request(`/schemes/${encodeURIComponent(schemeId)}/maps/layers/${encodeURIComponent(layerId)}`, this.json('DELETE'));
    return { data: null };
  }

  async setDrilldown(schemeId: string, topLayerId: string, schemeLevelId: string, frontLayerId: string | null) {
    await this.request(
      `/schemes/${encodeURIComponent(schemeId)}/maps/layers/${encodeURIComponent(topLayerId)}/drilldowns/${encodeURIComponent(schemeLevelId)}`,
      this.json('PUT', { frontLayerId: frontLayerId === null ? null : Number(frontLayerId) }),
    );
    return { data: null };
  }

  async validateMaps(schemeId: string) {
    return this.request<MapValidation>(`/schemes/${encodeURIComponent(schemeId)}/maps/validate`, this.json('POST'));
  }

  async reviewScheme(schemeId: string) {
    const response = await this.request<WireReview>(`/schemes/${encodeURIComponent(schemeId)}/review`);
    return {
      data: {
        schemeId,
        levelCount: response.data.counts.levels,
        locationCount: response.data.counts.locations,
        terminalCount: response.data.counts.terminalLocations,
        assignedRangeCount: response.data.counts.assignedRanges,
        missingRangeLocationIds: response.data.ranges.missingLocationCodes,
        mapValidation: response.data.maps,
        blockers: response.data.blockers,
        publishable: response.data.publishable,
      },
    };
  }

  async publishScheme(schemeId: string, activate: boolean) {
    const response = await this.request<WireScheme>(`/schemes/${encodeURIComponent(schemeId)}/publish`, this.json('POST', { activate }));
    return { data: baseScheme(response.data) };
  }

  async activateScheme(schemeId: string) {
    const response = await this.request<WireScheme>(`/schemes/${encodeURIComponent(schemeId)}/activate`, this.json('POST'));
    return { data: baseScheme(response.data) };
  }

  async searchTests(schemeId: string, callNumber: string) {
    const response = await this.request<WireSearchResult>(`/schemes/${encodeURIComponent(schemeId)}/search-tests`, this.json('POST', { callNumber }));
    const result = response.data;
    const data: SearchTestResult = {
      query: result.query.raw,
      normalized: formatNormalization(result.query.normalized),
      schemeId: String(result.scheme.schemeId),
      schemeName: result.scheme.name,
      matches: result.matches.map((match) => ({
        locationId: String(match.locationId),
        name: match.name,
        code: match.code,
        rangeStart: match.range?.start ?? '',
        rangeEnd: match.range?.end ?? '',
        route: match.route.map((item) => ({ name: item.name, code: item.code })),
      })),
      maps: {
        topViews: result.maps.topViews.map((view) => ({
          id: `${view.mapLayerId}:${view.assetUrl}`,
          name: view.name,
          assetUrl: view.assetUrl,
          highlightLocationCodes: view.highlightLocationCodes,
        })),
        frontViews: result.maps.frontViews.map((view) => ({
          id: `${view.mapLayerId}:${view.contextLocationId}:${view.mapLayerSvgId}`,
          name: view.name,
          assetUrl: view.assetUrl,
          highlightSlots: view.highlightSlots,
        })),
      },
    };
    return { data };
  }

  async exportLocationsCsv(schemeId: string, levelId?: string) {
    const query = levelId === undefined ? '' : `?levelId=${encodeURIComponent(levelId)}`;
    return this.requestText(`/schemes/${encodeURIComponent(schemeId)}/locations.csv${query}`, 'CSV_EXPORT_FAILED');
  }

  async exportLocationsText(schemeId: string) {
    return this.requestText(`/schemes/${encodeURIComponent(schemeId)}/locations.txt`, 'TEXT_EXPORT_FAILED');
  }
}
