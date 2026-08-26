-- ============================================================
-- Identity Model Refactor
--
-- 1. users table: rename camelCase columns → snake_case, add role
-- 2. employees → user_profiles: add user_id, drop clerk_user_id + email
-- 3. Domain tables: rename employee_id → profile_id
-- 4. Backfill user_profiles.user_id from shared Clerk ID
-- ============================================================

-- Step 1: Create the Role enum
CREATE TYPE "Role" AS ENUM ('super_admin', 'admin', 'manager', 'employee');

-- Step 2: Update users table
-- Drop old unique constraint referencing camelCase column
DROP INDEX IF EXISTS "users_clerkId_key";
DROP INDEX IF EXISTS "users_email_key";

-- Rename camelCase columns to snake_case
ALTER TABLE "users" RENAME COLUMN "clerkId" TO "clerk_id";
ALTER TABLE "users" RENAME COLUMN "firstName" TO "first_name";
ALTER TABLE "users" RENAME COLUMN "lastName" TO "last_name";
ALTER TABLE "users" RENAME COLUMN "imageUrl" TO "image_url";
ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at";

-- Make email nullable (employees may have no email)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- Add role column
ALTER TABLE "users" ADD COLUMN "role" "Role" NOT NULL DEFAULT 'employee';

-- Recreate unique indexes with snake_case column names
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Step 3: Rename employees → user_profiles
ALTER TABLE "employees" RENAME TO "user_profiles";

-- Step 4: Add user_id column to user_profiles (nullable)
ALTER TABLE "user_profiles" ADD COLUMN "user_id" TEXT;

-- Step 5: Backfill users.email from user_profiles.email (before dropping it)
UPDATE "users" u
SET email = up.email
FROM "user_profiles" up
WHERE up."clerk_user_id" = u."clerk_id"
  AND u.email IS NULL
  AND up.email IS NOT NULL;

-- Step 6: Backfill user_profiles.user_id from users via clerk_user_id
UPDATE "user_profiles" up
SET "user_id" = u.id
FROM "users" u
WHERE up."clerk_user_id" = u."clerk_id";

-- Step 7: Drop clerk_user_id and email from user_profiles
ALTER TABLE "user_profiles" DROP COLUMN "clerk_user_id";
ALTER TABLE "user_profiles" DROP COLUMN "email";

-- Step 8: Add unique constraint on user_profiles.user_id
CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");

-- Step 9: Add FK from user_profiles.user_id → users.id
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 10: Rename employee_id → profile_id in all domain tables
-- (Drop FKs first, rename column, then recreate FKs and indexes)

-- attendance_records
ALTER TABLE "attendance_records" DROP CONSTRAINT IF EXISTS "attendance_records_employee_id_fkey";
DROP INDEX IF EXISTS "attendance_records_employee_id_date_key";
DROP INDEX IF EXISTS "attendance_records_employee_id_idx";
ALTER TABLE "attendance_records" RENAME COLUMN "employee_id" TO "profile_id";
CREATE UNIQUE INDEX "attendance_records_date_profile_id_key" ON "attendance_records"("date", "profile_id");
CREATE INDEX "attendance_records_profile_id_idx" ON "attendance_records"("profile_id");
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- cash_advances
ALTER TABLE "cash_advances" DROP CONSTRAINT IF EXISTS "cash_advances_employee_id_fkey";
DROP INDEX IF EXISTS "cash_advances_employee_id_idx";
ALTER TABLE "cash_advances" RENAME COLUMN "employee_id" TO "profile_id";
CREATE INDEX "cash_advances_profile_id_idx" ON "cash_advances"("profile_id");
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- employee_devices
ALTER TABLE "employee_devices" DROP CONSTRAINT IF EXISTS "employee_devices_employee_id_fkey";
DROP INDEX IF EXISTS "employee_devices_employee_id_idx";
ALTER TABLE "employee_devices" RENAME COLUMN "employee_id" TO "profile_id";
CREATE INDEX "employee_devices_profile_id_idx" ON "employee_devices"("profile_id");
ALTER TABLE "employee_devices" ADD CONSTRAINT "employee_devices_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- payroll_run_items
ALTER TABLE "payroll_run_items" DROP CONSTRAINT IF EXISTS "payroll_run_items_employee_id_fkey";
DROP INDEX IF EXISTS "payroll_run_items_payroll_period_id_employee_id_key";
DROP INDEX IF EXISTS "payroll_run_items_employee_id_idx";
ALTER TABLE "payroll_run_items" RENAME COLUMN "employee_id" TO "profile_id";
CREATE UNIQUE INDEX "payroll_run_items_payroll_period_id_profile_id_key" ON "payroll_run_items"("payroll_period_id", "profile_id");
CREATE INDEX "payroll_run_items_profile_id_idx" ON "payroll_run_items"("profile_id");
ALTER TABLE "payroll_run_items" ADD CONSTRAINT "payroll_run_items_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- savings_accounts
ALTER TABLE "savings_accounts" DROP CONSTRAINT IF EXISTS "savings_accounts_employee_id_fkey";
DROP INDEX IF EXISTS "savings_accounts_employee_id_key";
ALTER TABLE "savings_accounts" RENAME COLUMN "employee_id" TO "profile_id";
CREATE UNIQUE INDEX "savings_accounts_profile_id_key" ON "savings_accounts"("profile_id");
ALTER TABLE "savings_accounts" ADD CONSTRAINT "savings_accounts_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- schedule_entries
ALTER TABLE "schedule_entries" DROP CONSTRAINT IF EXISTS "schedule_entries_employee_id_fkey";
DROP INDEX IF EXISTS "schedule_entries_date_employee_id_key";
DROP INDEX IF EXISTS "schedule_entries_employee_id_idx";
ALTER TABLE "schedule_entries" RENAME COLUMN "employee_id" TO "profile_id";
CREATE UNIQUE INDEX "schedule_entries_date_profile_id_key" ON "schedule_entries"("date", "profile_id");
CREATE INDEX "schedule_entries_profile_id_idx" ON "schedule_entries"("profile_id");
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- absence_requests
ALTER TABLE "absence_requests" DROP CONSTRAINT IF EXISTS "absence_requests_employee_id_fkey";
DROP INDEX IF EXISTS "absence_requests_employee_id_date_key";
ALTER TABLE "absence_requests" RENAME COLUMN "employee_id" TO "profile_id";
CREATE UNIQUE INDEX "absence_requests_profile_id_date_key" ON "absence_requests"("profile_id", "date");
ALTER TABLE "absence_requests" ADD CONSTRAINT "absence_requests_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
