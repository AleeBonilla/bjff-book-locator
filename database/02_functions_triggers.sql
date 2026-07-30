CREATE FUNCTION "validate_template_node"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_role location_role;
BEGIN
  IF NEW."role" = 'CONTAINER'
     AND (
       NEW."default_capacity_value" IS NOT NULL
       OR NEW."default_target_fill_ratio" IS NOT NULL
       OR NEW."default_allow_overflow" IS NOT NULL
     ) THEN
    RAISE EXCEPTION
      'distribution defaults are only valid for POSITION template nodes';
  END IF;

  IF NEW."parent_template_node_id" IS NOT NULL THEN
    SELECT "role"
    INTO parent_role
    FROM "structure_template_nodes"
    WHERE "structure_template_node_id" =
      NEW."parent_template_node_id"
      AND "structure_template_id" =
        NEW."structure_template_id";

    IF parent_role = 'POSITION' THEN
      RAISE EXCEPTION 'a POSITION template node cannot have children';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW."role" = 'POSITION'
     AND EXISTS (
       SELECT 1
       FROM "structure_template_nodes" child
       WHERE child."parent_template_node_id" =
         NEW."structure_template_node_id"
     ) THEN
    RAISE EXCEPTION
      'a template node with children cannot become POSITION';
  END IF;

  RETURN NEW;
END;
$$;

CREATE FUNCTION "protect_template_nodes"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_template_id INTEGER;
  target_template_status structure_template_status;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."structure_template_id" IS DISTINCT FROM
       NEW."structure_template_id" THEN
    RAISE EXCEPTION
      'a template node cannot move to another template';
  END IF;

  IF TG_OP = 'DELETE' THEN
    target_template_id := OLD."structure_template_id";
  ELSE
    target_template_id := NEW."structure_template_id";
  END IF;

  SELECT "status"
  INTO target_template_status
  FROM "structure_templates"
  WHERE "structure_template_id" = target_template_id;

  IF target_template_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION
      'template nodes can only change while the template is DRAFT';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_protect_template_nodes"
BEFORE INSERT OR UPDATE OR DELETE
ON "structure_template_nodes"
FOR EACH ROW
EXECUTE FUNCTION "protect_template_nodes"();

CREATE TRIGGER "trg_validate_template_node"
BEFORE INSERT OR UPDATE OF
  "structure_template_id",
  "parent_template_node_id",
  "role",
  "default_capacity_value",
  "default_capacity_unit",
  "default_target_fill_ratio",
  "default_allow_overflow"
ON "structure_template_nodes"
FOR EACH ROW
EXECUTE FUNCTION "validate_template_node"();

CREATE FUNCTION "validate_structure_template_status"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'ACTIVE'
     AND NEW."status" = 'DRAFT' THEN
    RAISE EXCEPTION
      'an ACTIVE template cannot return to DRAFT';
  END IF;

  IF NEW."status" = 'ACTIVE'
     AND (
       NOT EXISTS (
         SELECT 1
         FROM "structure_template_nodes" node
         WHERE node."structure_template_id" =
           NEW."structure_template_id"
           AND node."parent_template_node_id" IS NULL
       )
       OR NOT EXISTS (
         SELECT 1
         FROM "structure_template_nodes" node
         WHERE node."structure_template_id" =
           NEW."structure_template_id"
           AND node."role" = 'POSITION'
       )
     ) THEN
    RAISE EXCEPTION
      'an ACTIVE template requires one root and at least one POSITION';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_structure_template_status"
BEFORE UPDATE OF "status"
ON "structure_templates"
FOR EACH ROW
EXECUTE FUNCTION "validate_structure_template_status"();

CREATE FUNCTION "validate_location_hierarchy"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  expected_parent_template_node_id INTEGER;
  resolved_role location_role;
  actual_parent_template_node_id INTEGER;
  resolved_template_status structure_template_status;
BEGIN
  SELECT "status"
  INTO resolved_template_status
  FROM "structure_templates"
  WHERE "structure_template_id" =
    NEW."structure_template_id";

  IF TG_OP = 'INSERT'
     AND resolved_template_status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION
      'new locations require an ACTIVE template';
  END IF;

  SELECT "parent_template_node_id", "role"
  INTO expected_parent_template_node_id, resolved_role
  FROM "structure_template_nodes"
  WHERE "structure_template_node_id" =
    NEW."structure_template_node_id"
    AND "structure_template_id" =
      NEW."structure_template_id";

  IF NEW."parent_location_id" IS NULL THEN
    IF expected_parent_template_node_id IS NOT NULL THEN
      RAISE EXCEPTION
        'a root location must instantiate the template root';
    END IF;
  ELSE
    SELECT "structure_template_node_id"
    INTO actual_parent_template_node_id
    FROM "locations"
    WHERE "location_id" = NEW."parent_location_id"
      AND "scheme_id" = NEW."scheme_id"
      AND "structure_template_id" =
        NEW."structure_template_id";

    IF actual_parent_template_node_id IS NOT NULL
       AND actual_parent_template_node_id IS DISTINCT FROM
         expected_parent_template_node_id THEN
      RAISE EXCEPTION
        'the parent location does not match the template hierarchy';
    END IF;
  END IF;

  IF resolved_role = 'CONTAINER'
     AND NEW."leaf_sequence" IS NOT NULL THEN
    RAISE EXCEPTION
      'leaf_sequence is only valid for POSITION locations';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_location_hierarchy"
BEFORE INSERT OR UPDATE OF
  "scheme_id",
  "structure_template_id",
  "structure_template_node_id",
  "parent_location_id",
  "leaf_sequence"
ON "locations"
FOR EACH ROW
EXECUTE FUNCTION "validate_location_hierarchy"();

CREATE FUNCTION "validate_location_setting"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_role location_role;
BEGIN
  SELECT node."role"
  INTO resolved_role
  FROM "locations" location
  JOIN "structure_template_nodes" node
    ON node."structure_template_node_id" =
      location."structure_template_node_id"
   AND node."structure_template_id" =
      location."structure_template_id"
  WHERE location."location_id" = NEW."location_id"
    AND location."scheme_id" = NEW."scheme_id";

  IF resolved_role = 'CONTAINER'
     AND NOT NEW."inherit_to_descendants" THEN
    RAISE EXCEPTION
      'settings on CONTAINER locations must inherit to descendants';
  END IF;

  IF resolved_role = 'POSITION'
     AND NEW."inherit_to_descendants" THEN
    RAISE EXCEPTION
      'settings on POSITION locations cannot inherit to descendants';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_location_setting"
BEFORE INSERT OR UPDATE OF
  "location_id",
  "scheme_id",
  "inherit_to_descendants"
ON "location_distribution_settings"
FOR EACH ROW
EXECUTE FUNCTION "validate_location_setting"();

CREATE FUNCTION "validate_distribution_position"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_role location_role;
BEGIN
  SELECT node."role"
  INTO resolved_role
  FROM "locations" location
  JOIN "structure_template_nodes" node
    ON node."structure_template_node_id" =
      location."structure_template_node_id"
   AND node."structure_template_id" =
      location."structure_template_id"
  WHERE location."location_id" = NEW."location_id"
    AND location."scheme_id" = NEW."scheme_id";

  IF resolved_role IS DISTINCT FROM 'POSITION' THEN
    RAISE EXCEPTION
      'distribution inputs can only reference POSITION locations';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_distribution_position"
BEFORE INSERT OR UPDATE OF
  "location_id",
  "scheme_id"
ON "distribution_position_inputs"
FOR EACH ROW
EXECUTE FUNCTION "validate_distribution_position"();

CREATE FUNCTION "validate_scheme_activation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."is_active"
     AND NOT EXISTS (
       SELECT 1
       FROM "distribution_runs" run
       WHERE run."scheme_id" = NEW."scheme_id"
         AND run."is_published"
         AND run."status" = 'DONE'
     ) THEN
    RAISE EXCEPTION
      'an active scheme must have a published distribution';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_scheme_activation"
BEFORE INSERT OR UPDATE OF "is_active", "status"
ON "schemes"
FOR EACH ROW
EXECUTE FUNCTION "validate_scheme_activation"();

CREATE FUNCTION "validate_distribution_publication"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_scheme_status scheme_status;
BEGIN
  IF NEW."is_published" THEN
    SELECT "status"
    INTO current_scheme_status
    FROM "schemes"
    WHERE "scheme_id" = NEW."scheme_id";

    IF current_scheme_status IS DISTINCT FROM 'DISTRIBUTED' THEN
      RAISE EXCEPTION
        'a distribution can only be published for a distributed scheme';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_validate_distribution_publication"
BEFORE INSERT OR UPDATE OF
  "is_published",
  "status",
  "scheme_id"
ON "distribution_runs"
FOR EACH ROW
EXECUTE FUNCTION "validate_distribution_publication"();
