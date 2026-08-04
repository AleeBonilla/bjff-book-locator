import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from 'kysely';

/**
 * Tipos de las tablas que usa esta funcionalidad.
 *
 * La fuente de verdad de la estructura es `database/01_schema.sql`. Este archivo la
 * describe para Kysely; no la define. Cualquier cambio en el esquema debe llegar
 * primero al SQL y a `docs/db.md` (principios VII y X de la constitución).
 *
 * Se declaran las tablas que consumen las funcionalidades implementadas.
 */

export type ProcessStatus = 'PENDING' | 'DONE' | 'ERROR';
export type LoadErrorSeverity = 'REVIEW' | 'REJECTED';
export type UserRole = 'ADMIN';
export type SchemeStatus = 'DRAFT' | 'DEFINED' | 'DISTRIBUTED';
export type StructureTemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type LocationRole = 'CONTAINER' | 'POSITION';
export type CapacityUnit = 'BOOKS' | 'CENTIMETERS' | 'WEIGHT';
export type DistributionStrategy =
  | 'CAPACITY'
  | 'WEIGHTED'
  | 'ANCHORED'
  | 'HYBRID'
  | 'MANUAL';
export type RangeSource = 'AUTO' | 'ANCHORED' | 'MANUAL';

/** PostgreSQL entrega NUMERIC como texto; los repositorios convierten al responder. */
export type NumericColumn = ColumnType<string, string | number, string | number>;

export interface UsersTable {
  user_id: Generated<number>;
  username: string;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: Generated<UserRole>;
  enabled: Generated<boolean>;
  last_login_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface CollectionLoadsTable {
  collection_load_id: Generated<number>;
  title: string;
  filename: string;
  status: Generated<ProcessStatus>;
  rows_read: Generated<number>;
  rows_imported: Generated<number>;
  rows_without_key: Generated<number>;
  rows_flagged: Generated<number>;
  rows_rejected: Generated<number>;
  created_by: number | null;
  created_at: Generated<Date>;
}

export interface CollectionLoadErrorsTable {
  collection_load_error_id: Generated<number>;
  collection_load_id: number;
  row_number: number;
  severity: Generated<LoadErrorSeverity>;
  reason: string;
  raw_content: string | null;
}

export interface BooksTable {
  book_id: Generated<number>;
  collection_load_id: number;
  source_row_number: number;
  source_barcode: string;
  classification_raw: string | null;
  /** Columna `COLLATE "C"`: el orden no depende de la configuración regional. */
  comparable_key: string | null;
  isbn: string | null;
  title: string | null;
  author: string | null;
  copy_label: string | null;
  year: number | null;
  created_at: Generated<Date>;
}

export interface SchemesTable {
  scheme_id: Generated<number>;
  name: string;
  description: string | null;
  status: Generated<SchemeStatus>;
  is_active: Generated<boolean>;
  enabled: Generated<boolean>;
  based_on_scheme_id: number | null;
  created_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface StructureTemplatesTable {
  structure_template_id: Generated<number>;
  name: string;
  description: string | null;
  status: Generated<StructureTemplateStatus>;
  enabled: Generated<boolean>;
  created_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface StructureTemplateNodesTable {
  structure_template_node_id: Generated<number>;
  structure_template_id: number;
  parent_template_node_id: number | null;
  name: string;
  role: LocationRole;
  sort_order: Generated<number>;
  visual_kind: string | null;
  default_capacity_value: NumericColumn | null;
  default_capacity_unit: CapacityUnit | null;
  default_target_fill_ratio: NumericColumn | null;
  default_allow_overflow: boolean | null;
  enabled: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface LocationsTable {
  location_id: Generated<number>;
  scheme_id: number;
  structure_template_id: number;
  structure_template_node_id: number;
  parent_location_id: number | null;
  name: string;
  sort_order: Generated<number>;
  leaf_sequence: number | null;
  map_element_id: string | null;
  enabled: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface LocationDistributionSettingsTable {
  location_distribution_setting_id: Generated<number>;
  location_id: number;
  scheme_id: number;
  capacity_value: NumericColumn | null;
  capacity_unit: CapacityUnit | null;
  target_fill_ratio: NumericColumn | null;
  allow_overflow: boolean | null;
  inherit_to_descendants: Generated<boolean>;
  updated_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface DistributionRunsTable {
  distribution_run_id: Generated<number>;
  scheme_id: number;
  collection_load_id: number;
  based_on_distribution_run_id: number | null;
  strategy: Generated<DistributionStrategy>;
  parameters: Generated<Record<string, unknown>>;
  status: Generated<ProcessStatus>;
  default_capacity_value: NumericColumn | null;
  default_capacity_unit: CapacityUnit | null;
  default_target_fill_ratio: NumericColumn;
  default_allow_overflow: Generated<boolean>;
  book_count: Generated<number>;
  position_count: Generated<number>;
  unassigned_count: Generated<number>;
  is_published: Generated<boolean>;
  published_at: Date | null;
  error_message: string | null;
  created_by: number | null;
  created_at: Generated<Date>;
  finished_at: Date | null;
  revision: Generated<number>;
}

export interface DistributionPositionInputsTable {
  distribution_position_input_id: Generated<number>;
  distribution_run_id: number;
  scheme_id: number;
  location_id: number;
  position_sequence: number;
  capacity_value: NumericColumn | null;
  capacity_unit: CapacityUnit | null;
  target_fill_ratio: NumericColumn;
  allow_overflow: boolean;
  resolution: Generated<Record<string, unknown>>;
  created_at: Generated<Date>;
}

export interface DistributionAnchorsTable {
  distribution_anchor_id: Generated<number>;
  distribution_run_id: number;
  scheme_id: number;
  location_id: number;
  boundary_key: string;
  boundary_code: string;
  created_by: number | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface DistributionRangesTable {
  distribution_range_id: Generated<number>;
  distribution_run_id: number;
  scheme_id: number;
  location_id: number;
  range_sequence: number;
  range_start_key: string;
  range_end_key: string;
  range_start_code: string | null;
  range_end_code: string | null;
  source: Generated<RangeSource>;
  book_count: Generated<number>;
  reviewed_by: number | null;
  reviewed_at: Date | null;
  review_notes: string | null;
  created_at: Generated<Date>;
}

export interface BookPlacementsTable {
  book_placement_id: Generated<number>;
  distribution_run_id: number;
  scheme_id: number;
  collection_load_id: number;
  book_id: number;
  location_id: number;
  source: Generated<RangeSource>;
  created_at: Generated<Date>;
}

export interface LocationPathsTable {
  location_id: number;
  scheme_id: number;
  structure_template_id: number;
  structure_template_node_id: number;
  role: LocationRole;
  parent_location_id: number | null;
  name: string;
  sort_order: number;
  leaf_sequence: number | null;
  path: string;
  depth: number;
}

export interface Database {
  users: UsersTable;
  schemes: SchemesTable;
  structure_templates: StructureTemplatesTable;
  structure_template_nodes: StructureTemplateNodesTable;
  locations: LocationsTable;
  location_distribution_settings: LocationDistributionSettingsTable;
  collection_loads: CollectionLoadsTable;
  collection_load_errors: CollectionLoadErrorsTable;
  books: BooksTable;
  distribution_runs: DistributionRunsTable;
  distribution_position_inputs: DistributionPositionInputsTable;
  distribution_anchors: DistributionAnchorsTable;
  distribution_ranges: DistributionRangesTable;
  book_placements: BookPlacementsTable;
  location_paths: LocationPathsTable;
}

export type UserRow = Selectable<UsersTable>;
export type CollectionLoadRow = Selectable<CollectionLoadsTable>;
export type CollectionLoadErrorRow = Selectable<CollectionLoadErrorsTable>;
export type BookRow = Selectable<BooksTable>;
export type SchemeRow = Selectable<SchemesTable>;
export type StructureTemplateRow = Selectable<StructureTemplatesTable>;
export type StructureTemplateNodeRow = Selectable<StructureTemplateNodesTable>;
export type LocationRow = Selectable<LocationsTable>;
export type LocationDistributionSettingRow =
  Selectable<LocationDistributionSettingsTable>;
export type DistributionRunRow = Selectable<DistributionRunsTable>;
export type DistributionPositionInputRow = Selectable<DistributionPositionInputsTable>;
export type DistributionAnchorRow = Selectable<DistributionAnchorsTable>;
export type DistributionRangeRow = Selectable<DistributionRangesTable>;
export type BookPlacementRow = Selectable<BookPlacementsTable>;

export type NewBook = Insertable<BooksTable>;
export type NewCollectionLoadError = Insertable<CollectionLoadErrorsTable>;
export type NewDistributionRun = Insertable<DistributionRunsTable>;
export type DistributionRunUpdate = Updateable<DistributionRunsTable>;
