-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('pending', 'approved', 'active', 'completed', 'cancelled');

-- DropIndex
DROP INDEX "schedule_entries_profile_id_idx";

-- AlterTable
ALTER TABLE "payroll_run_items" ADD COLUMN     "loan_deduction" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user_profiles" RENAME CONSTRAINT "employees_pkey" TO "user_profiles_pkey";

-- CreateTable
CREATE TABLE "loans" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "term_periods" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "LoanStatus" NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "disbursed_at" TIMESTAMP(3),
    "disbursed_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_repayments" (
    "id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    "installment_no" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "applied_period_id" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loans_profile_id_idx" ON "loans"("profile_id");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "loan_repayments_loan_id_idx" ON "loan_repayments"("loan_id");

-- CreateIndex
CREATE INDEX "loan_repayments_applied_period_id_idx" ON "loan_repayments"("applied_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_repayments_loan_id_installment_no_key" ON "loan_repayments"("loan_id", "installment_no");

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_applied_period_id_fkey" FOREIGN KEY ("applied_period_id") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "employees_department_idx" RENAME TO "user_profiles_department_idx";

-- RenameIndex
ALTER INDEX "employees_employee_code_key" RENAME TO "user_profiles_employee_code_key";

-- RenameIndex
ALTER INDEX "employees_employment_status_idx" RENAME TO "user_profiles_employment_status_idx";

-- RenameIndex
ALTER INDEX "employees_username_key" RENAME TO "user_profiles_username_key";
