import type { ProductType, BstStatus, BstDiscrepancy } from "@/generated/prisma/enums";

/** A product-catalog category (reference data). */
export interface CategoryRow {
  id: string;
  name: string;
  /** How many products currently reference this category. */
  productCount: number;
  createdAt: string;
}

/** A catalog product as shown in the admin products table. */
export interface ProductRow {
  id: string;
  name: string;
  unit: string;
  type: ProductType;
  /** Selling price for sale items; null for production items. */
  price: number | null;
  categoryId: string;
  categoryName: string;
  createdAt: string;
}

/** One product as shown in the kiosk counting screen, with live on-hand. */
export interface KioskProduct {
  id: string;
  name: string;
  unit: string;
  type: ProductType;
  /** Selling price for sale items; null for production items. */
  price: number | null;
  categoryId: string;
  categoryName: string;
  /** Live on-hand = opening + restocks + bst_in − wastage − bst_out. */
  onHand: number;
  /** Branch reorder level, or null if none set. */
  reorderThreshold: number | null;
  /** True when a threshold is set and on-hand has dropped below it (§5.5). */
  lowStock: boolean;
}

/** Kiosk session summary for the shell/header. */
export interface KioskSessionInfo {
  id: string;
  sessionDate: string;
  openedAt: string;
  closed: boolean;
  currentOperatorId: string | null;
}

/** Everything the kiosk counting tab needs for a branch on the current day. */
export interface KioskState {
  branch: { id: string; name: string; closingTime: string | null };
  session: KioskSessionInfo | null;
  products: KioskProduct[];
  /** Category names present in the catalog, for the filter chips. */
  categories: { id: string; name: string }[];
  lowStockCount: number;
}

/** A cash advance or loan awaiting branch release, shown in the kiosk (§5.8). */
export interface ReleasableItem {
  kind: "advance" | "loan";
  id: string;
  slipNumber: string | null;
  employeeName: string;
  amount: number;
  branchName: string | null;
  /** Approval date — used to show how long it's been waiting. */
  decidedAt: string | null;
}

/** Admin cross-branch view row: an approved item still awaiting release. */
export interface UnreleasedRow extends ReleasableItem {
  /** Days since approval, for spotting stale items. */
  ageDays: number | null;
}

/** A released item not yet swept into payroll — an admin can undo it. */
export interface ReleasedRow {
  kind: "advance" | "loan";
  id: string;
  slipNumber: string | null;
  employeeName: string;
  amount: number;
  branchName: string | null;
  releaseBranchName: string | null;
  releasedAt: string | null;
}

// ── Reporting & variance (§5.4, 5.5) ────────────────────────────────────────

export interface ProductUsageRow {
  productId: string;
  name: string;
  unit: string;
  categoryName: string;
  /** Sold (sale items) or consumed (production items) over the range. */
  quantity: number;
  /** quantity × price for sale items; null for production items. */
  revenue: number | null;
  /** Total wastage logged over the range (§5.5). */
  wastage: number;
}

export interface CategoryUsageRow {
  categoryName: string;
  quantity: number;
  revenue: number | null;
}

export interface UsageReport {
  from: string;
  to: string;
  branchId: string | null;
  sale: ProductUsageRow[];
  production: ProductUsageRow[];
  saleCategories: CategoryUsageRow[];
  productionCategories: CategoryUsageRow[];
  totals: { soldQty: number; revenue: number; consumedQty: number; wastageQty: number };
}

/** Cross-branch low-stock row for the admin dashboard (§5.5/9.6). */
export interface LowStockRow {
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  unit: string;
  onHand: number;
  threshold: number;
}

// ── Session corrections (§5.6) ──────────────────────────────────────────────

export interface ClosedSessionRow {
  id: string;
  branchName: string;
  sessionDate: string;
  closedAt: string | null;
}

export interface CorrectionEntryRow {
  id: string;
  productName: string;
  unit: string;
  type: string;
  quantity: number;
  wastageReason: string | null;
  note: string | null;
  enteredAt: string;
}

// ── Branch Stock Transfer (§5.7) ────────────────────────────────────────────

export interface TransferLineRow {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  requestedQty: number;
  preparedQty: number | null;
  receivedQty: number | null;
}

export interface TransferRow {
  id: string;
  status: BstStatus;
  sourceBranchId: string;
  sourceBranchName: string;
  destBranchId: string;
  destBranchName: string;
  requestedAt: string;
  preparedAt: string | null;
  receivedAt: string | null;
  decisionNote: string | null;
  discrepancyResolution: BstDiscrepancy | null;
  discrepancyNote: string | null;
  /** True once received with at least one prepared≠received line and unresolved. */
  hasUnresolvedDiscrepancy: boolean;
  lines: TransferLineRow[];
}

/** Badge counts for the kiosk Transfers tab (this branch's pending work). */
export interface KioskTransferBadges {
  awaitingPrepare: number;
  awaitingReceive: number;
}

/** A per-branch reorder threshold row (joins branch + product). */
export interface ThresholdRow {
  id: string;
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  unit: string;
  reorderThreshold: number;
}
