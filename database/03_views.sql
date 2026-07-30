CREATE VIEW "location_paths" AS
WITH RECURSIVE paths AS (
  SELECT
    location."location_id",
    location."scheme_id",
    location."structure_template_id",
    location."structure_template_node_id",
    node."role",
    location."parent_location_id",
    location."name",
    location."sort_order",
    location."leaf_sequence",
    location."name"::TEXT AS "path",
    1 AS "depth"
  FROM "locations" location
  JOIN "structure_template_nodes" node
    ON node."structure_template_node_id" =
      location."structure_template_node_id"
   AND node."structure_template_id" =
      location."structure_template_id"
  WHERE location."parent_location_id" IS NULL

  UNION ALL

  SELECT
    child."location_id",
    child."scheme_id",
    child."structure_template_id",
    child."structure_template_node_id",
    node."role",
    child."parent_location_id",
    child."name",
    child."sort_order",
    child."leaf_sequence",
    paths."path" || ' / ' || child."name",
    paths."depth" + 1
  FROM "locations" child
  JOIN paths
    ON paths."location_id" = child."parent_location_id"
   AND paths."scheme_id" = child."scheme_id"
   AND paths."structure_template_id" =
     child."structure_template_id"
  JOIN "structure_template_nodes" node
    ON node."structure_template_node_id" =
      child."structure_template_node_id"
   AND node."structure_template_id" =
      child."structure_template_id"
)
SELECT * FROM paths;
