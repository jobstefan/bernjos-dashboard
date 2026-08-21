-- DropIndex
DROP INDEX "statutory_bir_brackets_tax_status_frequency_idx";

-- AlterTable
ALTER TABLE "employees" DROP COLUMN "date_regularized",
DROP COLUMN "employment_type",
DROP COLUMN "pagibig_number",
DROP COLUMN "tax_status",
DROP COLUMN "tin";

-- AlterTable
ALTER TABLE "statutory_bir_brackets" DROP COLUMN "tax_status";

-- DropEnum
DROP TYPE "EmploymentType";

-- DropEnum
DROP TYPE "TaxStatus";

-- CreateIndex
CREATE INDEX "statutory_bir_brackets_frequency_idx" ON "statutory_bir_brackets"("frequency");

