-- Up Migration

-- The historical filename is retained because it may already exist in migration tables.

ALTER TABLE "distribution_runs"
ADD COLUMN IF NOT EXISTS "revision" INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_distribution_runs_revision'
      AND conrelid = 'distribution_runs'::regclass
  ) THEN
    ALTER TABLE "distribution_runs"
    ADD CONSTRAINT "ck_distribution_runs_revision"
    CHECK ("revision" > 0);
  END IF;
END
$$;

-- Down Migration

ALTER TABLE "distribution_runs"
DROP CONSTRAINT IF EXISTS "ck_distribution_runs_revision";

ALTER TABLE "distribution_runs"
DROP COLUMN IF EXISTS "revision";
