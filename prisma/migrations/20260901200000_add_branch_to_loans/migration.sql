-- Add nullable branch_id to loans. Existing loans keep NULL (shown as "—" in the UI).
-- Branch is required going forward for admin-created and disbursed loans via form validation.
ALTER TABLE "loans" ADD COLUMN "branch_id" TEXT;

-- CreateIndex
CREATE INDEX "loans_branch_id_idx" ON "loans"("branch_id");

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
