-- CreateEnum
CREATE TYPE "AbsenceRequestStatus" AS ENUM ('pending', 'approved', 'declined');

-- CreateTable
CREATE TABLE "absence_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "status" "AbsenceRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_by" TEXT NOT NULL,
    "decided_by" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "absence_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "absence_requests_date_idx" ON "absence_requests"("date");

-- CreateIndex
CREATE INDEX "absence_requests_status_idx" ON "absence_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "absence_requests_employee_id_date_key" ON "absence_requests"("employee_id", "date");

-- AddForeignKey
ALTER TABLE "absence_requests" ADD CONSTRAINT "absence_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
