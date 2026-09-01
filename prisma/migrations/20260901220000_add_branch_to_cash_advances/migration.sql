-- Add nullable branch_id to cash_advances. Existing rows keep NULL (shown as "—" in the UI).
ALTER TABLE "cash_advances" ADD COLUMN "branch_id" TEXT;

-- CreateIndex
CREATE INDEX "cash_advances_branch_id_idx" ON "cash_advances"("branch_id");

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
