-- AlterTable
ALTER TABLE "stock_transfers" ADD COLUMN "slip_number" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_slip_number_key" ON "stock_transfers"("slip_number");

-- Create sequence for atomic slip number generation
CREATE SEQUENCE IF NOT EXISTS stock_transfer_slip_seq START 1;

-- Backfill existing transfers ordered by created_at as BST-{dest branch code}-{LPAD(rn,6)}
WITH ranked AS (
  SELECT
    st.id,
    ROW_NUMBER() OVER (ORDER BY st.created_at) AS rn,
    COALESCE(
      (SELECT b.code FROM branches b WHERE b.id = st.dest_branch_id),
      'UNK'
    ) AS bcode
  FROM stock_transfers st
)
UPDATE stock_transfers
SET slip_number = 'BST-' || ranked.bcode || '-' || LPAD(ranked.rn::text, 6, '0')
FROM ranked
WHERE stock_transfers.id = ranked.id;

-- Advance the sequence past backfilled values
SELECT setval(
  'stock_transfer_slip_seq',
  GREATEST((SELECT COUNT(*) FROM stock_transfers), 0) + 1
);
