-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "edited_at" TIMESTAMP(3),
ADD COLUMN     "edited_by" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'biometric',
ALTER COLUMN "import_id" DROP NOT NULL,
ALTER COLUMN "raw_row" DROP NOT NULL;
