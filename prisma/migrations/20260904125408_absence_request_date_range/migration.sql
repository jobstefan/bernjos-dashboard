-- DropIndex
DROP INDEX "absence_requests_profile_id_date_key";

-- AlterTable
ALTER TABLE "absence_requests" ADD COLUMN     "end_date" DATE;

-- CreateIndex
CREATE INDEX "absence_requests_profile_id_idx" ON "absence_requests"("profile_id");
