-- AlterTable
ALTER TABLE "branches" ADD COLUMN "code" VARCHAR(5);

-- AlterTable
ALTER TABLE "cash_advances" ADD COLUMN "slip_number" TEXT;

-- AlterTable
ALTER TABLE "loans" ADD COLUMN "slip_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cash_advances_slip_number_key" ON "cash_advances"("slip_number");

-- CreateIndex
CREATE UNIQUE INDEX "loans_slip_number_key" ON "loans"("slip_number");

-- Create sequences for atomic slip number generation
CREATE SEQUENCE IF NOT EXISTS cash_advance_slip_seq START 1;
CREATE SEQUENCE IF NOT EXISTS loan_slip_seq START 1;

-- Backfill branch codes for existing branches (B0001, B0002, ...)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) AS rn
  FROM branches
  WHERE deleted_at IS NULL
)
UPDATE branches
SET code = 'B' || LPAD(ranked.rn::text, 4, '0')
FROM ranked
WHERE branches.id = ranked.id;

-- Backfill slip numbers for existing cash advances
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at) AS rn,
    COALESCE(
      (SELECT b.code FROM branches b WHERE b.id = cash_advances.branch_id),
      'UNK'
    ) AS bcode
  FROM cash_advances
  WHERE deleted_at IS NULL
)
UPDATE cash_advances
SET slip_number = 'CA-' || ranked.bcode || '-' || LPAD(ranked.rn::text, 6, '0')
FROM ranked
WHERE cash_advances.id = ranked.id;

-- Advance the cash advance sequence past backfilled values
SELECT setval(
  'cash_advance_slip_seq',
  GREATEST((SELECT COUNT(*) FROM cash_advances WHERE deleted_at IS NULL), 0) + 1
);

-- Backfill slip numbers for existing loans
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at) AS rn,
    COALESCE(
      (SELECT b.code FROM branches b WHERE b.id = loans.branch_id),
      'UNK'
    ) AS bcode
  FROM loans
  WHERE deleted_at IS NULL
)
UPDATE loans
SET slip_number = 'LN-' || ranked.bcode || '-' || LPAD(ranked.rn::text, 6, '0')
FROM ranked
WHERE loans.id = ranked.id;

-- Advance the loan sequence past backfilled values
SELECT setval(
  'loan_slip_seq',
  GREATEST((SELECT COUNT(*) FROM loans WHERE deleted_at IS NULL), 0) + 1
);
