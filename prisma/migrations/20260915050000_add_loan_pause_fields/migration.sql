-- AlterTable
ALTER TABLE "loans"
  ADD COLUMN "paused_at"    TIMESTAMP(3),
  ADD COLUMN "paused_by"    TEXT,
  ADD COLUMN "pause_reason" TEXT,
  ADD COLUMN "resumed_at"   TIMESTAMP(3),
  ADD COLUMN "resumed_by"   TEXT;
