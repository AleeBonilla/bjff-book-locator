import type {
  ApiErrorBody,
  Carga,
  CreateNamedResourceRequest,
  CreateLocationRequest,
  CreateDistributionRunRequest,
  CreateTemplateNodeRequest,
  MoveTemplateNodeRequest,
  MoveLocationRequest,
  OrderLocationsRequest,
  OrderTemplateNodesRequest,
  Paginado,
  DistributionRunDetail,
  DistributionRunSummary,
  DistributionComparison,
  DistributionDerivationTemplate,
  PublishDistributionRunRequest,
  PublicSearchResult,
  RecalculateDistributionRunRequest,
  ReviewDistributionRangeRequest,
  ProblemaDeCarga,
  PublicSearchRequest,
  Registro,
  ReplaceLocationSettingsRequest,
  Scheme,
  SchemeDetail,
  SchemeLocation,
  ResumenDeCarga,
  SessionResponse,
  StructureTemplate,
  StructureTemplateDetail,
  SubtreePreview,
  TemplateNode,
  UpdateNamedResourceRequest,
  UpdateLocationRequest,
  UpdateTemplateNodeRequest,
} from '@bjff/api-types';

/**
 * Cliente del contrato REST.
 *
 * La interfaz no normaliza códigos ni calcula nada: consume el contrato
 * (principio VIII de la constitución). Toda regla vive en el servicio.
 */

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', ...init });

  if (response.status === 204) return undefined as T;

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (body as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Ocurrió un error inesperado.',
      response.status,
      error?.details,
    );
  }

  return body as T;
}

export const api = {
  login: (username: string, password: string) =>
    call<SessionResponse>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),

  logout: () => call<void>('/api/auth/logout', { method: 'POST' }),

  session: () => call<SessionResponse>('/api/auth/session'),

  importCollection: (file: File, title: string) => {
    const form = new FormData();
    form.append('file', file);
    const query = title ? `?title=${encodeURIComponent(title)}` : '';
    return call<Carga>(`/api/collection-loads${query}`, { method: 'POST', body: form });
  },

  loads: () => call<Paginado<ResumenDeCarga>>('/api/collection-loads'),

  load: (id: number) => call<Carga>(`/api/collection-loads/${id}`),

  problems: (id: number) =>
    call<Paginado<ProblemaDeCarga>>(`/api/collection-loads/${id}/errors`),

  deleteLoad: (id: number) =>
    call<void>(`/api/collection-loads/${id}`, { method: 'DELETE' }),

  books: (id: number, page: number, pageSize: number, withoutKey = false) => {
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(page * pageSize),
    });
    if (withoutKey) params.set('withoutKey', 'true');
    return call<Paginado<Registro>>(
      `/api/collection-loads/${id}/books?${params.toString()}`,
    );
  },

  templates: () => call<Paginado<StructureTemplate>>('/api/structure-templates'),

  template: (id: number) =>
    call<StructureTemplateDetail>(`/api/structure-templates/${id}`),

  createTemplate: (body: CreateNamedResourceRequest) =>
    call<StructureTemplateDetail>('/api/structure-templates', json('POST', body)),

  updateTemplate: (id: number, body: UpdateNamedResourceRequest) =>
    call<StructureTemplateDetail>(`/api/structure-templates/${id}`, json('PATCH', body)),

  activateTemplate: (id: number) =>
    call<StructureTemplateDetail>(`/api/structure-templates/${id}/activate`, {
      method: 'POST',
    }),

  archiveTemplate: (id: number) =>
    call<StructureTemplateDetail>(`/api/structure-templates/${id}/archive`, {
      method: 'POST',
    }),

  createTemplateNode: (templateId: number, body: CreateTemplateNodeRequest) =>
    call<TemplateNode>(
      `/api/structure-templates/${templateId}/nodes`,
      json('POST', body),
    ),

  updateTemplateNode: (
    templateId: number,
    nodeId: number,
    body: UpdateTemplateNodeRequest,
  ) =>
    call<TemplateNode>(
      `/api/structure-templates/${templateId}/nodes/${nodeId}`,
      json('PATCH', body),
    ),

  moveTemplateNode: (templateId: number, nodeId: number, body: MoveTemplateNodeRequest) =>
    call<void>(
      `/api/structure-templates/${templateId}/nodes/${nodeId}/move`,
      json('POST', body),
    ),

  orderTemplateNodes: (templateId: number, body: OrderTemplateNodesRequest) =>
    call<void>(`/api/structure-templates/${templateId}/nodes/order`, json('PUT', body)),

  templateNodeDeletionPreview: (templateId: number, nodeId: number) =>
    call<SubtreePreview>(
      `/api/structure-templates/${templateId}/nodes/${nodeId}/deletion-preview`,
    ),

  deleteTemplateNode: (templateId: number, nodeId: number, confirmed: boolean) =>
    call<void>(
      `/api/structure-templates/${templateId}/nodes/${nodeId}?confirmed=${confirmed}`,
      { method: 'DELETE' },
    ),

  schemes: () => call<Paginado<Scheme>>('/api/schemes'),

  scheme: (id: number) => call<SchemeDetail>(`/api/schemes/${id}`),

  createScheme: (body: CreateNamedResourceRequest) =>
    call<SchemeDetail>('/api/schemes', json('POST', body)),

  updateScheme: (id: number, body: UpdateNamedResourceRequest) =>
    call<SchemeDetail>(`/api/schemes/${id}`, json('PATCH', body)),

  defineScheme: (id: number) =>
    call<SchemeDetail>(`/api/schemes/${id}/define`, { method: 'POST' }),

  copyScheme: (id: number, body: CreateNamedResourceRequest) =>
    call<SchemeDetail>(`/api/schemes/${id}/copy`, json('POST', body)),

  createLocation: (schemeId: number, body: CreateLocationRequest) =>
    call<SchemeLocation>(`/api/schemes/${schemeId}/locations`, json('POST', body)),

  updateLocation: (schemeId: number, locationId: number, body: UpdateLocationRequest) =>
    call<SchemeLocation>(
      `/api/schemes/${schemeId}/locations/${locationId}`,
      json('PATCH', body),
    ),

  moveLocation: (schemeId: number, locationId: number, body: MoveLocationRequest) =>
    call<void>(
      `/api/schemes/${schemeId}/locations/${locationId}/move`,
      json('POST', body),
    ),

  orderLocations: (schemeId: number, body: OrderLocationsRequest) =>
    call<void>(`/api/schemes/${schemeId}/locations/order`, json('PUT', body)),

  locationDeletionPreview: (schemeId: number, locationId: number) =>
    call<SubtreePreview>(
      `/api/schemes/${schemeId}/locations/${locationId}/deletion-preview`,
    ),

  deleteLocation: (schemeId: number, locationId: number, confirmed: boolean) =>
    call<void>(
      `/api/schemes/${schemeId}/locations/${locationId}?confirmed=${confirmed}`,
      { method: 'DELETE' },
    ),

  replaceLocationSettings: (
    schemeId: number,
    locationId: number,
    body: ReplaceLocationSettingsRequest,
  ) =>
    call<SchemeLocation | void>(
      `/api/schemes/${schemeId}/locations/${locationId}/settings`,
      json('PUT', body),
    ),

  deleteLocationSettings: (schemeId: number, locationId: number) =>
    call<void>(`/api/schemes/${schemeId}/locations/${locationId}/settings`, {
      method: 'DELETE',
    }),

  distributionRuns: (schemeId?: number) => {
    const query = schemeId === undefined ? '' : `?schemeId=${schemeId}`;
    return call<Paginado<DistributionRunSummary>>(`/api/distribution-runs${query}`);
  },

  distributionRun: (id: number) =>
    call<DistributionRunDetail>(`/api/distribution-runs/${id}`),

  createDistributionRun: (body: CreateDistributionRunRequest) =>
    call<DistributionRunDetail>('/api/distribution-runs', json('POST', body)),

  publishDistributionRun: (id: number, body: PublishDistributionRunRequest) =>
    call<DistributionRunDetail>(
      `/api/distribution-runs/${id}/publish`,
      json('POST', body),
    ),

  recalculateDistributionRun: (id: number, body: RecalculateDistributionRunRequest) =>
    call<DistributionRunDetail>(
      `/api/distribution-runs/${id}/recalculate`,
      json('POST', body),
    ),

  reviewDistributionRange: (
    runId: number,
    rangeId: number,
    body: ReviewDistributionRangeRequest,
  ) =>
    call<DistributionRunDetail>(
      `/api/distribution-runs/${runId}/ranges/${rangeId}/review`,
      json('PUT', body),
    ),

  testDistributionSearch: (id: number, classificationCode: string) =>
    call<PublicSearchResult>(
      `/api/distribution-runs/${id}/test-search`,
      json('POST', { classificationCode }),
    ),

  distributionDerivationTemplate: (id: number) =>
    call<DistributionDerivationTemplate>(
      `/api/distribution-runs/${id}/derivation-template`,
    ),

  distributionComparison: (id: number, againstRunId?: number) => {
    const query = againstRunId === undefined ? '' : `?againstRunId=${againstRunId}`;
    return call<DistributionComparison>(
      `/api/distribution-runs/${id}/comparison${query}`,
    );
  },

  publicSearch: (body: PublicSearchRequest) =>
    call<PublicSearchResult>('/api/public/search', json('POST', body)),
};

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
