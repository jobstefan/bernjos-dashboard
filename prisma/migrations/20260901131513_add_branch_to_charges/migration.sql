-- Add branch_id as nullable first so existing rows don't block the migration.
-- Backfill existing rows to the first branch (alphabetically); rows with no
-- matching branch are deleted to keep referential integrity.
ALTER TABLE "charges" ADD COLUMN "branch_id" TEXT;

UPDATE "charges"
SET "branch_id" = (SELECT "id" FROM "branches" WHERE "deleted_at" IS NULL ORDER BY "name" ASC LIMIT 1)
WHERE "branch_id" IS NULL;

DELETE FROM "charges" WHERE "branch_id" IS NULL;

ALTER TABLE "charges" ALTER COLUMN "branch_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "charges_branch_id_idx" ON "charges"("branch_id");

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
