-- CreateEnum
CREATE TYPE "PayrollRunType" AS ENUM ('regular', 'off_cycle');

-- AlterTable
ALTER TABLE "payroll_periods"
  ADD COLUMN "run_type" "PayrollRunType" NOT NULL DEFAULT 'regular',
  ADD COLUMN "selected_profile_ids" TEXT[] NOT NULL DEFAULT '{}';
