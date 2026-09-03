-- AlterTable
ALTER TABLE "cash_advances" ADD COLUMN     "deletion_requested_at" TIMESTAMP(3),
ADD COLUMN     "deletion_requested_by" TEXT;

-- AlterTable
ALTER TABLE "charges" ADD COLUMN     "deletion_requested_at" TIMESTAMP(3),
ADD COLUMN     "deletion_requested_by" TEXT;

-- AlterTable
ALTER TABLE "incentives" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deletion_requested_at" TIMESTAMP(3),
ADD COLUMN     "deletion_requested_by" TEXT;

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "deletion_requested_at" TIMESTAMP(3),
ADD COLUMN     "deletion_requested_by" TEXT;
