import "server-only";
import {
  attachOperator,
  closeSessionRow,
  createSession,
  endOpenOperatorStints,
  findActiveOperator,
  findEntriesOfType,
  findPreviousSession,
  findSession,
  findSessionById,
  insertEntries,
  insertEntry,
  sumEntriesBySession,
} from "@/server/db/inventory";
import { findBranchById } from "@/server/db/branches";
import { findProducts, findThresholdsForBranch } from "@/server/db/inventory-catalog";
import { auditLog } from "@/server/services/audit.service";
import { businessDateFor } from "@/lib/inventory/business-date";
import {
  BadRequestError,
  InvalidStateTransitionError,
  NotFoundError,
} from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type { InventoryEntryType } from "@/generated/prisma/enums";
import type {
  KioskProduct,
  KioskSessionInfo,
  KioskState,
} from "@/lib/types/inventory";
import type {
  LogRestockSchema,
  LogWastageSchema,
  CloseSessionSchema,
  OfflineEntry,
} from "@/lib/validations/inventory-session";

/** Movement types that add to (or subtract from) live on-hand. `closing` is the
 * end-of-day count, not a movement, so it's excluded from the running total. */
const ON_HAND_SIGN: Partial<Record<InventoryEntryType, number>> = {
  opening: 1,
  restock: 1,
  bst_in: 1,
  wastage: -1,
  bst_out: -1,
};

/** Compute live on-hand per productId from the session's grouped entry sums. */
async function onHandByProduct(sessionId: string): Promise<Map<string, number>> {
  const sums = await sumEntriesBySession(sessionId);
  const map = new Map<string, number>();
  for (const row of sums) {
    const sign = ON_HAND_SIGN[row.type];
    if (!sign) continue;
    const qty = (row._sum.quantity ?? 0) * sign;
    map.set(row.productId, (map.get(row.productId) ?? 0) + qty);
  }
  return map;
}

/**
 * Open today's session for a branch, or continue an existing one — attaching the
 * current operator and logging a handoff if a different operator was active
 * (§5.1). On first open, opening counts are pre-filled from the previous
 * session's closing counts to minimise re-entry.
 */
export async function openOrContinueSession(branchId: string, actor: Actor): Promise<{ sessionId: string }> {
  const branch = await findBranchById(branchId);
  if (!branch) throw new NotFoundError("Branch", branchId);

  const sessionDate = businessDateFor(new Date(), branch.closingTime);
  const existing = await findSession(branchId, sessionDate);

  if (existing) {
    if (existing.closedAt) return { sessionId: existing.id };
    const active = await findActiveOperator(existing.id);
    if (!active || active.operatorId !== actor.clerkUserId) {
      const previousOperatorId = active?.operatorId ?? null;
      await endOpenOperatorStints(existing.id);
      await attachOperator(existing.id, actor.clerkUserId);
      await auditLog({
        actor,
        action: "inventory.session.handoff",
        entityType: "inventory_session",
        entityId: existing.id,
        before: { operatorId: previousOperatorId },
        after: { operatorId: actor.clerkUserId },
      });
    }
    return { sessionId: existing.id };
  }

  // First open of the day → create session, attach operator, prefill opening.
  const session = await createSession(branchId, sessionDate, actor.clerkUserId);
  await attachOperator(session.id, actor.clerkUserId);

  const previous = await findPreviousSession(branchId, sessionDate);
  if (previous) {
    const closing = await findEntriesOfType(previous.id, "closing");
    if (closing.length > 0) {
      await insertEntries(
        closing
          .filter((c) => c.quantity !== 0)
          .map((c) => ({
            sessionId: session.id,
            productId: c.productId,
            type: "opening" as InventoryEntryType,
            quantity: c.quantity,
            enteredBy: actor.clerkUserId,
          })),
      );
    }
  }

  await auditLog({
    actor,
    action: "inventory.session.opened",
    entityType: "inventory_session",
    entityId: session.id,
    after: session,
  });
  return { sessionId: session.id };
}

async function requireOpenSession(sessionId: string) {
  const session = await findSessionById(sessionId);
  if (!session) throw new NotFoundError("Inventory session", sessionId);
  if (session.closedAt) {
    throw new InvalidStateTransitionError("This session is closed. Ask an admin to correct it.");
  }
  return session;
}

export async function logRestock(input: LogRestockSchema, actor: Actor): Promise<void> {
  await requireOpenSession(input.sessionId);
  const entry = await insertEntry({
    sessionId: input.sessionId,
    productId: input.productId,
    type: "restock",
    quantity: input.quantity,
    enteredBy: actor.clerkUserId,
  });
  await auditLog({
    actor,
    action: "inventory.restock",
    entityType: "inventory_entry",
    entityId: entry.id,
    after: entry,
  });
}

export async function logWastage(input: LogWastageSchema, actor: Actor): Promise<void> {
  await requireOpenSession(input.sessionId);
  const entry = await insertEntry({
    sessionId: input.sessionId,
    productId: input.productId,
    type: "wastage",
    quantity: input.quantity,
    wastageReason: input.reason,
    note: input.note ?? null,
    enteredBy: actor.clerkUserId,
  });
  await auditLog({
    actor,
    action: "inventory.wastage",
    entityType: "inventory_entry",
    entityId: entry.id,
    after: entry,
  });
}

/** Record closing counts and lock the session (§5.1 step 6–8). */
export async function closeSession(input: CloseSessionSchema, actor: Actor): Promise<void> {
  const session = await requireOpenSession(input.sessionId);
  if (input.counts.length === 0) {
    throw new BadRequestError("Enter closing counts before closing the session.");
  }
  await insertEntries(
    input.counts.map((c) => ({
      sessionId: session.id,
      productId: c.productId,
      type: "closing" as InventoryEntryType,
      quantity: c.quantity,
      enteredBy: actor.clerkUserId,
    })),
  );
  await endOpenOperatorStints(session.id);
  const after = await closeSessionRow(session.id, actor.clerkUserId);
  await auditLog({
    actor,
    action: "inventory.session.closed",
    entityType: "inventory_session",
    entityId: session.id,
    before: session,
    after,
  });
}

export interface SyncResult {
  applied: number;
  superseded: { clientId: string; reason: string }[];
}

/**
 * Replay entries queued offline on the kiosk (§6/§9.7). Each keeps its original
 * timestamp. Conflict resolution is admin-wins: if the target session was closed
 * (or removed) by an admin while the device was offline, the operator's queued
 * entry is preserved but flagged `supersededBy` — kept for the trail, excluded
 * from every derivation — and reported back so the operator can be notified.
 */
export async function syncOfflineEntries(entries: OfflineEntry[], actor: Actor): Promise<SyncResult> {
  let applied = 0;
  const superseded: { clientId: string; reason: string }[] = [];

  for (const e of entries) {
    const session = await findSessionById(e.sessionId);
    const closedOrMissing = !session || session.closedAt !== null;
    const entry = await insertEntry({
      sessionId: e.sessionId,
      productId: e.productId,
      type: e.type,
      quantity: e.quantity,
      wastageReason: e.type === "wastage" ? e.reason ?? null : null,
      note: e.note ?? null,
      enteredBy: actor.clerkUserId,
      enteredAt: e.enteredAt,
      supersededBy: closedOrMissing ? "offline-superseded" : null,
    });

    if (closedOrMissing) {
      superseded.push({ clientId: e.clientId, reason: session ? "session closed" : "session missing" });
      await auditLog({
        actor,
        action: "inventory.offline_entry.superseded",
        entityType: "inventory_entry",
        entityId: entry.id,
        after: entry,
      });
    } else {
      applied += 1;
      await auditLog({
        actor,
        action: `inventory.${e.type}.synced`,
        entityType: "inventory_entry",
        entityId: entry.id,
        after: entry,
      });
    }
  }

  return { applied, superseded };
}

/** Assemble everything the kiosk counting screen needs for a branch today. */
export async function getKioskState(branchId: string): Promise<KioskState> {
  const branch = await findBranchById(branchId);
  if (!branch) throw new NotFoundError("Branch", branchId);

  const sessionDate = businessDateFor(new Date(), branch.closingTime);
  const [session, products, thresholds] = await Promise.all([
    findSession(branchId, sessionDate),
    findProducts(),
    findThresholdsForBranch(branchId),
  ]);

  const thresholdByProduct = new Map(thresholds.map((t) => [t.productId, t.reorderThreshold]));
  const onHand = session ? await onHandByProduct(session.id) : new Map<string, number>();

  const kioskProducts: KioskProduct[] = products.map((p) => {
    const qty = onHand.get(p.id) ?? 0;
    const threshold = thresholdByProduct.get(p.id) ?? null;
    return {
      id: p.id,
      name: p.name,
      unit: p.unit,
      type: p.type,
      price: p.price == null ? null : Number(p.price),
      categoryId: p.categoryId,
      categoryName: p.category.name,
      onHand: qty,
      reorderThreshold: threshold,
      lowStock: threshold != null && qty < threshold,
    };
  });

  const categoryMap = new Map<string, string>();
  for (const p of kioskProducts) categoryMap.set(p.categoryId, p.categoryName);

  let sessionInfo: KioskSessionInfo | null = null;
  if (session) {
    const active = session.operators.find((o) => o.endedAt === null) ?? null;
    sessionInfo = {
      id: session.id,
      sessionDate: session.sessionDate.toISOString(),
      openedAt: session.openedAt.toISOString(),
      closed: session.closedAt !== null,
      currentOperatorId: active?.operatorId ?? null,
    };
  }

  return {
    branch: { id: branch.id, name: branch.name, closingTime: branch.closingTime },
    session: sessionInfo,
    products: kioskProducts,
    categories: [...categoryMap.entries()].map(([id, name]) => ({ id, name })),
    lowStockCount: kioskProducts.filter((p) => p.lowStock).length,
  };
}
