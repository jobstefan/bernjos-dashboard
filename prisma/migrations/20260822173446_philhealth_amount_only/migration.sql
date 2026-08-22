-- AlterTable
ALTER TABLE "employees" DROP COLUMN "philhealth_enabled",
ALTER COLUMN "philhealth_amount" DROP NOT NULL;
