-- CreateEnum
CREATE TYPE "IncentiveStatus" AS ENUM ('pending', 'applied', 'cancelled');

-- AlterTable
ALTER TABLE "payroll_run_items" ADD COLUMN     "incentive_earnings" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "incentives" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "IncentiveStatus" NOT NULL DEFAULT 'pending',
    "period_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_by" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "incentives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incentives_profile_id_idx" ON "incentives"("profile_id");

-- CreateIndex
CREATE INDEX "incentives_status_idx" ON "incentives"("status");

-- AddForeignKey
ALTER TABLE "incentives" ADD CONSTRAINT "incentives_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incentives" ADD CONSTRAINT "incentives_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
