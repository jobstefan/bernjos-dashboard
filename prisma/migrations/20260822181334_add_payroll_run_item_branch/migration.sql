-- CreateTable
CREATE TABLE "payroll_run_item_branches" (
    "id" TEXT NOT NULL,
    "run_item_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "days_worked" DECIMAL(6,2) NOT NULL,
    "gross_pay" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "payroll_run_item_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_run_item_branches_run_item_id_idx" ON "payroll_run_item_branches"("run_item_id");

-- AddForeignKey
ALTER TABLE "payroll_run_item_branches" ADD CONSTRAINT "payroll_run_item_branches_run_item_id_fkey" FOREIGN KEY ("run_item_id") REFERENCES "payroll_run_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_item_branches" ADD CONSTRAINT "payroll_run_item_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
