import "server-only";
import {
  findSessionsInRange,
  sumEntriesForSessions,
  findSession,
  sumEntriesBySession,
} from "@/server/db/inventory";
import { findBranches } from "@/server/db/branches";
import { findProducts, findThresholdsForBranch } from "@/server/db/inventory-catalog";
import { businessDateFor } from "@/lib/inventory/business-date";
import type { InventoryEntryType } from "@/generated/prisma/enums";
import type {
  CategoryUsageRow,
  LowStockRow,
  ProductUsageRow,
  UsageReport,
} from "@/lib/types/inventory";

/** Full derivation sign: usage = opening + restock + bst_in − wastage − bst_out − closing. */
const USAGE_SIGN: Record<InventoryEntryType, number> = {
  opening: 1,
  restock: 1,
  bst_in: 1,
  wastage: -1,
  bst_out: -1,
  closing: -1,
};

const ON_HAND_SIGN: Partial<Record<InventoryEntryType, number>> = {
  opening: 1,
  restock: 1,
  bst_in: 1,
  wastage: -1,
  bst_out: -1,
};

function rollupByCategory(rows: ProductUsageRow[]): CategoryUsageRow[] {
  const map = new Map<string, CategoryUsageRow>();
  for (const r of rows) {
    const cur = map.get(r.categoryName) ?? { categoryName: r.categoryName, quantity: 0, revenue: r.revenue == null ? null : 0 };
    cur.quantity += r.quantity;
    if (r.revenue != null) cur.revenue = (cur.revenue ?? 0) + r.revenue;
    map.set(r.categoryName, cur);
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity);
}

/**
 * Sold (sale) / consumed (production) per product over [from, to], with an
 * estimated-revenue rollup for sale items only (§5.4). Optionally one branch.
 */
export async function getUsageReport(
  from: Date,
  to: Date,
  branchId?: string,
): Promise<UsageReport> {
  const [sessions, products] = await Promise.all([
    findSessionsInRange(from, to, branchId),
    findProducts(),
  ]);
  const sessionIds = sessions.map((s) => s.id);
  const sums = sessionIds.length > 0 ? await sumEntriesForSessions(sessionIds) : [];

  const usage = new Map<string, number>();
  const wastage = new Map<string, number>();
  for (const row of sums) {
    const qty = row._sum.quantity ?? 0;
    usage.set(row.productId, (usage.get(row.productId) ?? 0) + qty * USAGE_SIGN[row.type]);
    if (row.type === "wastage") wastage.set(row.productId, (wastage.get(row.productId) ?? 0) + qty);
  }

  const sale: ProductUsageRow[] = [];
  const production: ProductUsageRow[] = [];
  for (const p of products) {
    const quantity = usage.get(p.id) ?? 0;
    const waste = wastage.get(p.id) ?? 0;
    // Skip products with no movement at all in the range to keep the report tight.
    if (quantity === 0 && waste === 0) continue;
    const price = p.price == null ? null : Number(p.price);
    const row: ProductUsageRow = {
      productId: p.id,
      name: p.name,
      unit: p.unit,
      categoryName: p.category.name,
      quantity,
      revenue: p.type === "sale" && price != null ? Math.max(0, quantity) * price : null,
      wastage: waste,
    };
    if (p.type === "sale") sale.push(row);
    else production.push(row);
  }

  sale.sort((a, b) => b.quantity - a.quantity);
  production.sort((a, b) => b.quantity - a.quantity);

  const totals = {
    soldQty: sale.reduce((s, r) => s + r.quantity, 0),
    revenue: sale.reduce((s, r) => s + (r.revenue ?? 0), 0),
    consumedQty: production.reduce((s, r) => s + r.quantity, 0),
    wastageQty: [...sale, ...production].reduce((s, r) => s + r.wastage, 0),
  };

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    branchId: branchId ?? null,
    sale,
    production,
    saleCategories: rollupByCategory(sale),
    productionCategories: rollupByCategory(production),
    totals,
  };
}

/**
 * Current low-stock across all branches (§9.6): today's on-hand under the
 * branch-specific reorder threshold. Powers the admin cross-branch view.
 */
export async function getLowStockAcrossBranches(): Promise<LowStockRow[]> {
  const [branches, products] = await Promise.all([findBranches(), findProducts()]);
  const productById = new Map(products.map((p) => [p.id, p]));
  const rows: LowStockRow[] = [];

  for (const branch of branches) {
    const sessionDate = businessDateFor(new Date(), branch.closingTime);
    const [session, thresholds] = await Promise.all([
      findSession(branch.id, sessionDate),
      findThresholdsForBranch(branch.id),
    ]);
    if (thresholds.length === 0) continue;

    const onHand = new Map<string, number>();
    if (session) {
      const sums = await sumEntriesBySession(session.id);
      for (const row of sums) {
        const sign = ON_HAND_SIGN[row.type];
        if (!sign) continue;
        onHand.set(row.productId, (onHand.get(row.productId) ?? 0) + (row._sum.quantity ?? 0) * sign);
      }
    }

    for (const t of thresholds) {
      const product = productById.get(t.productId);
      if (!product) continue;
      const qty = onHand.get(t.productId) ?? 0;
      if (qty < t.reorderThreshold) {
        rows.push({
          branchId: branch.id,
          branchName: branch.name,
          productId: t.productId,
          productName: product.name,
          unit: product.unit,
          onHand: qty,
          threshold: t.reorderThreshold,
        });
      }
    }
  }

  return rows.sort(
    (a, b) => a.onHand - a.threshold - (b.onHand - b.threshold),
  );
}
