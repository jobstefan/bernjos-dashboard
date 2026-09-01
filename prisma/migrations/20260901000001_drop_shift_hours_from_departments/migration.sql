-- Shift hours now live on positions; the department-level column is no longer used.
ALTER TABLE "departments" DROP COLUMN "shift_hours";
