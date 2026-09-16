-- Add `cancelled` to ChargeStatus enum and the cancellation tracking columns.

ALTER TYPE "ChargeStatus" ADD VALUE IF NOT EXISTS 'cancelled';

ALTER TABLE "charges"
  ADD COLUMN IF NOT EXISTS "cancelled_by" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
