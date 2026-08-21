-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('regular', 'probationary', 'contractual', 'part_time');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('active', 'inactive', 'resigned', 'terminated');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('semi_monthly', 'monthly');

-- CreateEnum
CREATE TYPE "TaxStatus" AS ENUM ('S', 'S1', 'S2', 'S3', 'S4', 'ME', 'ME1', 'ME2', 'ME3', 'ME4');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('draft', 'calculated', 'pending_approval', 'approved', 'paid');

-- CreateEnum
CREATE TYPE "RunItemStatus" AS ENUM ('included', 'excluded');

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "clerk_user_id" TEXT,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "email" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "employment_type" "EmploymentType" NOT NULL,
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'active',
    "date_hired" DATE NOT NULL,
    "date_regularized" DATE,
    "basic_salary" DECIMAL(12,2) NOT NULL,
    "pay_frequency" "PayFrequency" NOT NULL DEFAULT 'semi_monthly',
    "tax_status" "TaxStatus" NOT NULL,
    "sss_number" TEXT,
    "philhealth_number" TEXT,
    "pagibig_number" TEXT,
    "tin" TEXT,
    "bank_name" TEXT,
    "bank_account_number" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_sss_brackets" (
    "id" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "min_salary" DECIMAL(12,2) NOT NULL,
    "max_salary" DECIMAL(12,2) NOT NULL,
    "monthly_credit" DECIMAL(12,2) NOT NULL,
    "employee_share" DECIMAL(6,4) NOT NULL,
    "employer_share" DECIMAL(6,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statutory_sss_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_philhealth_brackets" (
    "id" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "min_salary" DECIMAL(12,2) NOT NULL,
    "max_salary" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "min_contribution" DECIMAL(12,2) NOT NULL,
    "max_contribution" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statutory_philhealth_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_pagibig_rates" (
    "id" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "min_salary" DECIMAL(12,2) NOT NULL,
    "max_salary" DECIMAL(12,2) NOT NULL,
    "employee_rate" DECIMAL(6,4) NOT NULL,
    "employer_rate" DECIMAL(6,4) NOT NULL,
    "max_contribution" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statutory_pagibig_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_bir_brackets" (
    "id" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "tax_status" "TaxStatus" NOT NULL,
    "frequency" "PayFrequency" NOT NULL,
    "min_taxable" DECIMAL(12,2) NOT NULL,
    "max_taxable" DECIMAL(12,2) NOT NULL,
    "base_tax" DECIMAL(12,2) NOT NULL,
    "excess_over" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(6,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "statutory_bir_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "period_label" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "pay_date" DATE NOT NULL,
    "frequency" "PayFrequency" NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'draft',
    "created_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "paid_by" TEXT,
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_items" (
    "id" TEXT NOT NULL,
    "payroll_period_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "basic_salary" DECIMAL(12,2) NOT NULL,
    "gross_pay" DECIMAL(12,2) NOT NULL,
    "sss_employee" DECIMAL(12,2) NOT NULL,
    "philhealth_employee" DECIMAL(12,2) NOT NULL,
    "pagibig_employee" DECIMAL(12,2) NOT NULL,
    "bir_withholding" DECIMAL(12,2) NOT NULL,
    "other_deductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "other_earnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(12,2) NOT NULL,
    "net_pay" DECIMAL(12,2) NOT NULL,
    "status" "RunItemStatus" NOT NULL DEFAULT 'included',
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_run_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_clerk_user_id_key" ON "employees"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE INDEX "employees_employment_status_idx" ON "employees"("employment_status");

-- CreateIndex
CREATE INDEX "employees_department_idx" ON "employees"("department");

-- CreateIndex
CREATE INDEX "statutory_sss_brackets_effective_date_idx" ON "statutory_sss_brackets"("effective_date");

-- CreateIndex
CREATE INDEX "statutory_philhealth_brackets_effective_date_idx" ON "statutory_philhealth_brackets"("effective_date");

-- CreateIndex
CREATE INDEX "statutory_pagibig_rates_effective_date_idx" ON "statutory_pagibig_rates"("effective_date");

-- CreateIndex
CREATE INDEX "statutory_bir_brackets_effective_date_idx" ON "statutory_bir_brackets"("effective_date");

-- CreateIndex
CREATE INDEX "statutory_bir_brackets_tax_status_frequency_idx" ON "statutory_bir_brackets"("tax_status", "frequency");

-- CreateIndex
CREATE INDEX "payroll_periods_status_idx" ON "payroll_periods"("status");

-- CreateIndex
CREATE INDEX "payroll_run_items_employee_id_idx" ON "payroll_run_items"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_run_items_payroll_period_id_employee_id_key" ON "payroll_run_items"("payroll_period_id", "employee_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- AddForeignKey
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
