-- AlterTable
ALTER TABLE "payroll_run_items" ADD COLUMN     "advance_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "late_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0;
