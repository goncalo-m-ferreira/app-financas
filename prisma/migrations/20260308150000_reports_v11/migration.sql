-- Reports V1.1 observability fields.
-- Legacy backfill note:
-- Existing rows use created_at-derived month/year as an approximate historical fallback.
-- New rows persist canonical month/year from report request input.
ALTER TABLE "reports"
ADD COLUMN IF NOT EXISTS "month" INTEGER,
ADD COLUMN IF NOT EXISTS "year" INTEGER,
ADD COLUMN IF NOT EXISTS "error_message" TEXT;

UPDATE "reports"
SET
  "month" = EXTRACT(MONTH FROM "created_at")::INTEGER,
  "year" = EXTRACT(YEAR FROM "created_at")::INTEGER
WHERE "month" IS NULL OR "year" IS NULL;

ALTER TABLE "reports"
ALTER COLUMN "month" SET NOT NULL,
ALTER COLUMN "year" SET NOT NULL;
