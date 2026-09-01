-- Add nullable branch_id to incentives. Existing rows keep NULL (shown as "—" in the UI).
ALTER TABLE "incentives" ADD COLUMN "branch_id" TEXT;

-- CreateIndex
CREATE INDEX "incentives_branch_id_idx" ON "incentives"("branch_id");

-- AddForeignKey
ALTER TABLE "incentives" ADD CONSTRAINT "incentives_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
