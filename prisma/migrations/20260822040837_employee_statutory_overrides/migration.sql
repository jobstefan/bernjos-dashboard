-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "philhealth_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "philhealth_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sss_salary_basis" DECIMAL(12,2);
