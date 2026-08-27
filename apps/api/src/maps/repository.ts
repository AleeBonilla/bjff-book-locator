import type { Queryable } from '../db/transaction.js';

export interface LayerRow {
  map_layer_id: number;
  scheme_id: number;
  name: string;
  view_type: 'TOP' | 'FRONT' | 'OTHER';
  render_mode: 'STATIC' | 'TEMPLATE';
  enabled: boolean;
}

export interface LayerLevelRow {
  map_layer_id: number;
  scheme_level_id: number;
  drilldown_map_layer_id: number | null;
}

export interface SvgRow {
  map_layer_svg_id: number;
  map_layer_id: number;
  name: string;
  variant_code: string | null;
  asset_url: string;
  slot_count: number | null;
  enabled: boolean;
}

export interface AssignmentRow {
  map_layer_id: number;
  map_layer_svg_id: number;
  context_location_id: number;
}

export interface MapSnapshot {
  layers: LayerRow[];
  levels: LayerLevelRow[];
  svgs: SvgRow[];
  assignments: AssignmentRow[];
}

export async function findMapSnapshot(database: Queryable, schemeId: number): Promise<MapSnapshot> {
  const layers = await database.query<LayerRow>(
    'SELECT map_layer_id, scheme_id, name, view_type, render_mode, enabled FROM map_layers WHERE scheme_id = $1 ORDER BY map_layer_id',
    [schemeId],
  );
  const levels = await database.query<LayerLevelRow>(
    `SELECT mlsl.map_layer_id, mlsl.scheme_level_id, mlsl.drilldown_map_layer_id
       FROM map_layer_scheme_levels AS mlsl
       JOIN map_layers AS ml ON ml.map_layer_id = mlsl.map_layer_id
      WHERE ml.scheme_id = $1
      ORDER BY mlsl.map_layer_id, mlsl.scheme_level_id`,
    [schemeId],
  );
  const svgs = await database.query<SvgRow>(
    `SELECT svg.map_layer_svg_id, svg.map_layer_id, svg.name, svg.variant_code,
            svg.asset_url, svg.slot_count, svg.enabled
       FROM map_layer_svgs AS svg
       JOIN map_layers AS ml ON ml.map_layer_id = svg.map_layer_id
      WHERE ml.scheme_id = $1
      ORDER BY svg.map_layer_id, svg.map_layer_svg_id`,
    [schemeId],
  );
  const assignments = await database.query<AssignmentRow>(
    `SELECT assignment.map_layer_id, assignment.map_layer_svg_id,
            assignment.context_location_id
       FROM map_layer_svg_assignments AS assignment
       JOIN map_layers AS ml ON ml.map_layer_id = assignment.map_layer_id
      WHERE ml.scheme_id = $1
      ORDER BY assignment.map_layer_id, assignment.context_location_id`,
    [schemeId],
  );
  return { layers: layers.rows, levels: levels.rows, svgs: svgs.rows, assignments: assignments.rows };
}
