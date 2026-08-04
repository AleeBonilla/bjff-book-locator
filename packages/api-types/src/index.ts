/**
 * Tipos compartidos del contrato REST.
 *
 * Fuente: specs/001-collection-import/contracts/rest-api.md
 *
 * Este paquete no tiene código en tiempo de ejecución: existe para que el frontend y
 * el backend no puedan desincronizarse sobre la forma de las respuestas.
 */

// --- Errores ---

/** Códigos de error que devuelve la API. */
export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'NO_FILE'
  | 'FILE_TOO_LARGE'
  | 'TOO_MANY_ROWS'
  | 'INVALID_ENCODING'
  | 'EMPTY_FILE'
  | 'MISSING_HEADER'
  | 'MISSING_REQUIRED_COLUMN'
  | 'LOAD_NOT_FOUND'
  | 'LOAD_IN_USE'
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_NODE_NOT_FOUND'
  | 'SCHEME_NOT_FOUND'
  | 'LOCATION_NOT_FOUND'
  | 'TEMPLATE_NOT_EDITABLE'
  | 'SCHEME_NOT_EDITABLE'
  | 'INVALID_STATE_TRANSITION'
  | 'TEMPLATE_NAME_CONFLICT'
  | 'SCHEME_NAME_CONFLICT'
  | 'SIBLING_NAME_CONFLICT'
  | 'MAP_ELEMENT_CONFLICT'
  | 'SUBTREE_CONFIRMATION_REQUIRED'
  | 'INVALID_TEMPLATE_TREE'
  | 'INVALID_SCHEME_TREE'
  | 'INVALID_PARENT'
  | 'TREE_CYCLE'
  | 'ORDER_MISMATCH'
  | 'INVALID_DISTRIBUTION_SETTINGS'
  | 'SCHEME_LINEAGE_CYCLE'
  | 'DISTRIBUTION_RUN_NOT_FOUND'
  | 'DISTRIBUTION_RANGE_NOT_FOUND'
  | 'RUN_BUSY'
  | 'RUN_VERSION_CONFLICT'
  | 'RUN_IMMUTABLE'
  | 'INVALID_RUN_STATE'
  | 'INVALID_RUN_LINEAGE'
  | 'INVALID_STRATEGY_INPUTS'
  | 'INVALID_EFFECTIVE_CONFIGURATION'
  | 'INVALID_ANCHORS'
  | 'INVALID_MANUAL_RANGES'
  | 'COMPARISON_BASE_REQUIRED'
  | 'UNASSIGNED_CONFIRMATION_REQUIRED'
  | 'VALIDATION_FAILED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    /** Mensaje en español, apto para mostrarse a la persona usuaria (SC-010). */
    message: string;
    details?: Record<string, unknown>;
  };
}

// --- Autenticación ---

export type UserRole = 'ADMIN';

export interface Usuario {
  userId: number;
  username: string;
  fullName: string | null;
  role: UserRole;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SessionResponse {
  user: Usuario;
}

// --- Cargas de colección ---

export type LoadStatus = 'PENDING' | 'DONE' | 'ERROR';

export type LoadErrorSeverity = 'REVIEW' | 'REJECTED';

export interface LoadCounters {
  rowsRead: number;
  rowsImported: number;
  rowsWithoutKey: number;
  rowsFlagged: number;
  rowsRejected: number;
}

export interface ResumenDeCarga {
  collectionLoadId: number;
  title: string;
  filename: string;
  status: LoadStatus;
  counters: LoadCounters;
  createdBy: { userId: number; username: string } | null;
  createdAt: string;
}

export interface Carga extends ResumenDeCarga {
  /** Motivo general del fallo cuando `status` es `ERROR`. */
  errorMessage: string | null;
}

export interface ProblemaDeCarga {
  collectionLoadErrorId: number;
  rowNumber: number;
  severity: LoadErrorSeverity;
  reason: string;
  /**
   * Código de clasificación original que provocó el problema (FR-038a). Sin él, el
   * motivo no permite entender qué hay que corregir. Es `null` cuando la fila no llegó
   * a importarse.
   */
  classificationRaw: string | null;
  /**
   * Contenido original de la fila, para diagnóstico. Puede contener datos de la
   * colección privada: solo se entrega con sesión activa (FR-044).
   */
  rawContent: string | null;
}

export interface Registro {
  bookId: number;
  sourceRowNumber: number;
  sourceBarcode: string;
  /** Código de clasificación tal como venía en el archivo (FR-016). */
  classificationRaw: string | null;
  /** Clave derivada. `null` cuando el código está ausente (FR-024). */
  comparableKey: string | null;
  isbn: string | null;
  title: string | null;
  author: string | null;
  copyLabel: string | null;
  year: number | null;
}

// --- Paginación ---

export interface Paginado<T> {
  items: T[];
  total: number;
}

// --- Modelado de estructura física ---

export type StructureTemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type SchemeStatus = 'DRAFT' | 'DEFINED' | 'DISTRIBUTED';
export type LocationRole = 'CONTAINER' | 'POSITION';
export type CapacityUnit = 'BOOKS' | 'CENTIMETERS' | 'WEIGHT';
export type SchemeUnavailableReason =
  'SCHEME_DISABLED' | 'SCHEME_NOT_DEFINED' | 'TEMPLATE_DISABLED' | 'NO_USABLE_POSITIONS';

export interface AuditUser {
  userId: number;
  username: string;
}

export interface Capacity {
  value: number;
  unit: CapacityUnit;
}

export interface DistributionValues {
  capacity: Capacity | null;
  targetFillRatio: number | null;
  allowOverflow: boolean | null;
}

export interface TemplateNode {
  structureTemplateNodeId: number;
  parentTemplateNodeId: number | null;
  name: string;
  role: LocationRole;
  position: number;
  visualKind: string | null;
  enabled: boolean;
  defaults: DistributionValues | null;
  children: TemplateNode[];
}

export interface StructureTemplate {
  structureTemplateId: number;
  name: string;
  description: string | null;
  status: StructureTemplateStatus;
  enabled: boolean;
  createdBy: AuditUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface StructureTemplateDetail extends StructureTemplate {
  nodes: TemplateNode[];
}

export interface LocationSettings extends DistributionValues {
  inheritToDescendants: boolean;
  updatedBy: AuditUser | null;
  updatedAt: string;
}

export interface SchemeLocation {
  locationId: number;
  parentLocationId: number | null;
  structureTemplateId: number;
  structureTemplateNodeId: number;
  name: string;
  role: LocationRole;
  position: number;
  leafSequence: number | null;
  mapElementId: string | null;
  enabled: boolean;
  usable: boolean;
  settings: LocationSettings | null;
  children: SchemeLocation[];
}

export interface Scheme {
  schemeId: number;
  name: string;
  description: string | null;
  status: SchemeStatus;
  enabled: boolean;
  isActive: boolean;
  basedOnSchemeId: number | null;
  availableForNewRun: boolean;
  unavailableReasons: SchemeUnavailableReason[];
  createdBy: AuditUser | null;
  createdAt: string;
  updatedAt: string;
}

export interface SchemeDetail extends Scheme {
  locations: SchemeLocation[];
}

export interface CreateNamedResourceRequest {
  name: string;
  description?: string | null;
}

export interface UpdateNamedResourceRequest {
  name?: string;
  description?: string | null;
  enabled?: boolean;
}

export interface CreateTemplateNodeRequest {
  parentTemplateNodeId: number | null;
  name: string;
  role: LocationRole;
  position?: number;
  visualKind?: string | null;
  enabled?: boolean;
  defaults?: DistributionValues | null;
}

export interface UpdateTemplateNodeRequest {
  name?: string;
  role?: LocationRole;
  visualKind?: string | null;
  enabled?: boolean;
  defaults?: DistributionValues | null;
}

export interface MoveTreeItemRequest {
  parentId: number | null;
  position: number;
}

export interface OrderTreeItemsRequest {
  parentId: number | null;
  orderedIds: number[];
}

export interface MoveTemplateNodeRequest {
  parentTemplateNodeId: number | null;
  position: number;
}

export interface OrderTemplateNodesRequest {
  parentTemplateNodeId: number | null;
  orderedNodeIds: number[];
}

export interface MoveLocationRequest {
  parentLocationId: number | null;
  position: number;
}

export interface OrderLocationsRequest {
  parentLocationId: number | null;
  orderedLocationIds: number[];
}

export interface CreateLocationRequest {
  parentLocationId: number | null;
  structureTemplateId: number;
  structureTemplateNodeId: number;
  name: string;
  position?: number;
  mapElementId?: string | null;
  enabled?: boolean;
}

export interface UpdateLocationRequest {
  name?: string;
  mapElementId?: string | null;
  enabled?: boolean;
}

export type ReplaceLocationSettingsRequest = DistributionValues;

export interface SubtreePreviewItem {
  id: number;
  parentId: number | null;
  name: string;
  role: LocationRole;
}

export interface SubtreePreview {
  root: Omit<SubtreePreviewItem, 'parentId'>;
  descendantCount: number;
  items: SubtreePreviewItem[];
}

// --- Distribución y búsqueda pública ---

export type DistributionStrategy =
  'CAPACITY' | 'WEIGHTED' | 'ANCHORED' | 'HYBRID' | 'MANUAL';
export type DistributionStatus = 'PENDING' | 'DONE' | 'ERROR';
export type RangeSource = 'AUTO' | 'ANCHORED' | 'MANUAL';
export type ResolutionSource = 'LOCATION' | 'ANCESTOR' | 'TEMPLATE' | 'RUN';

export interface RunDefaults {
  capacity: Capacity | null;
  targetFillRatio: number;
  allowOverflow: boolean;
}

export interface AnchorInput {
  locationId: number;
  boundaryCode: string;
}

export interface ManualRangeInput {
  locationId: number;
  startCode: string | null;
  endCode: string | null;
}

export interface CreateDistributionRunRequest {
  schemeId: number;
  collectionLoadId: number;
  basedOnDistributionRunId?: number | null;
  strategy?: DistributionStrategy;
  defaults: RunDefaults;
  anchors?: AnchorInput[];
  manualRanges?: ManualRangeInput[];
}

export interface RecalculateDistributionRunRequest {
  expectedRevision: number;
  rebuildSnapshot: boolean;
  defaults: RunDefaults;
  anchors?: AnchorInput[];
  manualRanges?: ManualRangeInput[];
}

export interface PublishDistributionRunRequest {
  expectedRevision: number;
  previewAccepted: boolean;
  unassignedAccepted?: boolean;
}

export interface ReviewDistributionRangeRequest {
  expectedRevision: number;
  notes: string | null;
}

export interface DistributionRunCounters {
  bookCount: number;
  positionCount: number;
  unassignedCount: number;
}

export interface DistributionWarnings {
  unassignedCount: number;
  emptyPositionCount: number;
  overloadedPositionCount: number;
  splitKeyCount: number;
}

export interface DistributionRunSummary {
  distributionRunId: number;
  schemeId: number;
  collectionLoadId: number;
  basedOnDistributionRunId: number | null;
  strategy: DistributionStrategy;
  status: DistributionStatus;
  revision: number;
  defaults: RunDefaults;
  counters: DistributionRunCounters;
  isPublished: boolean;
  publishedAt: string | null;
  errorMessage: string | null;
  createdBy: AuditUser | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface FieldResolution {
  source: ResolutionSource;
  sourceId: number | null;
}

export interface DistributionPositionInput {
  locationId: number;
  positionSequence: number;
  path: string;
  capacity: Capacity | null;
  targetFillRatio: number;
  allowOverflow: boolean;
  resolution: {
    capacity: FieldResolution;
    targetFillRatio: FieldResolution;
    allowOverflow: FieldResolution;
  };
}

export interface DistributionAnchor {
  locationId: number;
  boundaryCode: string;
  path: string;
}

export interface DistributionRange {
  distributionRangeId: number;
  locationId: number;
  rangeSequence: number;
  startCode: string | null;
  endCode: string | null;
  source: RangeSource;
  bookCount: number;
  path: string;
  reviewedBy: AuditUser | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export interface DistributionRunDetail extends DistributionRunSummary {
  positions: DistributionPositionInput[];
  anchors: DistributionAnchor[];
  ranges: DistributionRange[];
  warnings: DistributionWarnings;
}

export interface DistributionDerivationTemplate {
  basedOnDistributionRunId: number;
  schemeId: number;
  suggestedCollectionLoadId: number;
  strategy: DistributionStrategy;
  defaults: RunDefaults;
  anchors: AnchorInput[];
  manualRanges: ManualRangeInput[];
}

export interface DistributionCounterChanges {
  assigned: number;
  unassigned: number;
  emptyPositions: number;
  overloadedPositions: number;
  splitKeys: number;
}

export interface DistributionRangeChange {
  locationId: number;
  path: string;
  before: { startCode: string | null; endCode: string | null } | null;
  after: { startCode: string | null; endCode: string | null } | null;
}

export interface DistributionComparison {
  runId: number;
  againstRunId: number;
  counterChanges: DistributionCounterChanges;
  rangeChanges: DistributionRangeChange[];
}

export type PublicSearchMatchType = 'EXACT' | 'RANGE';

export interface PublicLocation {
  path: string;
  mapElementId: string | null;
}

export interface PublicSearchResult {
  status: 'FOUND' | 'NOT_FOUND';
  matchType: PublicSearchMatchType | null;
  approximate: true;
  message: string;
  locations: PublicLocation[];
}

export interface PublicSearchRequest {
  classificationCode: string;
}
