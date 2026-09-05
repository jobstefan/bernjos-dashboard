-- CreateTable
CREATE TABLE "attendance_record_branches" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "time_from" TEXT NOT NULL,
    "time_to" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "attendance_record_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_record_branches_record_id_idx" ON "attendance_record_branches"("record_id");

-- AddForeignKey
ALTER TABLE "attendance_record_branches" ADD CONSTRAINT "attendance_record_branches_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "attendance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_record_branches" ADD CONSTRAINT "attendance_record_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
