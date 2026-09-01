-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('pending', 'applied');

-- AlterTable
ALTER TABLE "payroll_run_items" ADD COLUMN     "charge_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "charges" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ChargeStatus" NOT NULL DEFAULT 'pending',
    "created_by" TEXT NOT NULL,
    "applied_period_id" TEXT,
    "applied_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "charges_profile_id_idx" ON "charges"("profile_id");

-- CreateIndex
CREATE INDEX "charges_status_idx" ON "charges"("status");

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charges" ADD CONSTRAINT "charges_applied_period_id_fkey" FOREIGN KEY ("applied_period_id") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
