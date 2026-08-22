-- Savings is now mandatory with a ₱100 floor and no "paused" state.

-- Backfill: every non-deleted employee without a savings account gets one at
-- the ₱100 minimum.
INSERT INTO "savings_accounts" ("id", "employee_id", "contribution_amount", "created_by", "created_at", "updated_at")
SELECT gen_random_uuid()::text, e."id", 100, 'system', now(), now()
FROM "employees" e
WHERE e."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "savings_accounts" s WHERE s."employee_id" = e."id"
  );

-- Raise any existing contribution below the new ₱100 minimum.
UPDATE "savings_accounts" SET "contribution_amount" = 100 WHERE "contribution_amount" < 100;

-- AlterTable
ALTER TABLE "savings_accounts" DROP COLUMN "active",
ALTER COLUMN "contribution_amount" SET DEFAULT 100;
