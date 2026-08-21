-- CreateEnum
CREATE TYPE "CashAdvanceStatus" AS ENUM ('pending', 'approved', 'declined', 'applied', 'cancelled');

-- CreateTable
CREATE TABLE "cash_advances" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CashAdvanceStatus" NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "applied_period_id" TEXT,
    "applied_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_advances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_advances_employee_id_idx" ON "cash_advances"("employee_id");

-- CreateIndex
CREATE INDEX "cash_advances_status_idx" ON "cash_advances"("status");

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_applied_period_id_fkey" FOREIGN KEY ("applied_period_id") REFERENCES "payroll_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
