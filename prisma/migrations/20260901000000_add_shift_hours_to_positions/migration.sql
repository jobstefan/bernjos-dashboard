-- Add shift_hours to positions, seeding from the parent department so
-- existing payroll behavior is preserved for all live positions.
ALTER TABLE "positions" ADD COLUMN "shift_hours" INTEGER NOT NULL DEFAULT 8;

UPDATE "positions" p
SET "shift_hours" = d."shift_hours"
FROM "departments" d
WHERE p."department_id" = d.id;
