-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_import_id_fkey";

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "attendance_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
