-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('sale', 'production');

-- CreateEnum
CREATE TYPE "InventoryEntryType" AS ENUM ('opening', 'restock', 'wastage', 'closing', 'bst_in', 'bst_out');

-- CreateEnum
CREATE TYPE "WastageReason" AS ENUM ('expired', 'damaged', 'given_away', 'other');

-- CreateEnum
CREATE TYPE "BstStatus" AS ENUM ('requested', 'approved', 'prepared', 'received', 'declined', 'cancelled');

-- CreateEnum
CREATE TYPE "BstDiscrepancy" AS ENUM ('sender_wastage', 'receiver_wastage', 'variance_note');

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "closing_time" TEXT;

-- AlterTable
ALTER TABLE "cash_advances" ADD COLUMN     "release_branch_id" TEXT,
ADD COLUMN     "released_at" TIMESTAMP(3),
ADD COLUMN     "released_by" TEXT;

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "release_branch_id" TEXT;

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "type" "ProductType" NOT NULL,
    "price" DECIMAL(12,2),
    "category_id" TEXT NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_product_thresholds" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "reorder_threshold" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_product_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_sessions" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "session_date" DATE NOT NULL,
    "opened_by" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by" TEXT,
    "closed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_session_operators" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "inventory_session_operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_entries" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "type" "InventoryEntryType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "wastage_reason" "WastageReason",
    "note" TEXT,
    "bst_id" TEXT,
    "superseded_by" TEXT,
    "entered_by" TEXT NOT NULL,
    "entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "source_branch_id" TEXT NOT NULL,
    "dest_branch_id" TEXT NOT NULL,
    "status" "BstStatus" NOT NULL DEFAULT 'requested',
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "prepared_by" TEXT,
    "prepared_at" TIMESTAMP(3),
    "received_by" TEXT,
    "received_at" TIMESTAMP(3),
    "decision_note" TEXT,
    "discrepancy_resolution" "BstDiscrepancy",
    "discrepancy_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" TEXT NOT NULL,
    "transfer_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "requested_qty" INTEGER NOT NULL,
    "prepared_qty" INTEGER,
    "received_qty" INTEGER,

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_name_key" ON "product_categories"("name");

-- CreateIndex
CREATE INDEX "products_type_idx" ON "products"("type");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "branch_product_thresholds_branch_id_idx" ON "branch_product_thresholds"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "branch_product_thresholds_branch_id_product_id_key" ON "branch_product_thresholds"("branch_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_sessions_branch_id_idx" ON "inventory_sessions"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_sessions_branch_id_session_date_key" ON "inventory_sessions"("branch_id", "session_date");

-- CreateIndex
CREATE INDEX "inventory_session_operators_session_id_idx" ON "inventory_session_operators"("session_id");

-- CreateIndex
CREATE INDEX "inventory_entries_session_id_idx" ON "inventory_entries"("session_id");

-- CreateIndex
CREATE INDEX "inventory_entries_product_id_idx" ON "inventory_entries"("product_id");

-- CreateIndex
CREATE INDEX "inventory_entries_bst_id_idx" ON "inventory_entries"("bst_id");

-- CreateIndex
CREATE INDEX "stock_transfers_source_branch_id_idx" ON "stock_transfers"("source_branch_id");

-- CreateIndex
CREATE INDEX "stock_transfers_dest_branch_id_idx" ON "stock_transfers"("dest_branch_id");

-- CreateIndex
CREATE INDEX "stock_transfers_status_idx" ON "stock_transfers"("status");

-- CreateIndex
CREATE INDEX "stock_transfer_lines_transfer_id_idx" ON "stock_transfer_lines"("transfer_id");

-- AddForeignKey
ALTER TABLE "cash_advances" ADD CONSTRAINT "cash_advances_release_branch_id_fkey" FOREIGN KEY ("release_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_release_branch_id_fkey" FOREIGN KEY ("release_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_product_thresholds" ADD CONSTRAINT "branch_product_thresholds_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_product_thresholds" ADD CONSTRAINT "branch_product_thresholds_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_sessions" ADD CONSTRAINT "inventory_sessions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_session_operators" ADD CONSTRAINT "inventory_session_operators_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "inventory_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "inventory_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_source_branch_id_fkey" FOREIGN KEY ("source_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_dest_branch_id_fkey" FOREIGN KEY ("dest_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
