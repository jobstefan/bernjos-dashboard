import "server-only";
import {
  countAwaitingPrepare,
  countAwaitingReceive,
  countPendingApproval,
  findAllTransfers,
  findTransferById,
  findTransfersForBranch,
  insertTransfer,
  updateTransfer,
  updateTransferLine,
} from "@/server/db/stock-transfer";
import { insertEntries } from "@/server/db/inventory";
import { openOrContinueSession } from "@/server/services/inventory.service";
import { auditLog } from "@/server/services/audit.service";
import {
  BadRequestError,
  InvalidStateTransitionError,
  NotFoundError,
} from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type { InventoryEntryType } from "@/generated/prisma/enums";
import type { KioskTransferBadges, TransferRow } from "@/lib/types/inventory";
import type {
  PrepareTransferSchema,
  ReceiveTransferSchema,
  RequestTransferSchema,
  ResolveDiscrepancySchema,
} from "@/lib/validations/stock-transfer";

type TransferWithRelations = NonNullable<Awaited<ReturnType<typeof findTransferById>>>;

function toRow(t: TransferWithRelations): TransferRow {
  const lines = t.lines.map((l) => ({
    id: l.id,
    productId: l.productId,
    productName: l.product.name,
    unit: l.product.unit,
    requestedQty: l.requestedQty,
    preparedQty: l.preparedQty,
    receivedQty: l.receivedQty,
  }));
  const mismatch = lines.some((l) => l.preparedQty !== null && l.receivedQty !== l.preparedQty);
  return {
    id: t.id,
    status: t.status,
    sourceBranchId: t.sourceBranchId,
    sourceBranchName: t.sourceBranch.name,
    destBranchId: t.destBranchId,
    destBranchName: t.destBranch.name,
    requestedAt: t.requestedAt.toISOString(),
    preparedAt: t.preparedAt?.toISOString() ?? null,
    receivedAt: t.receivedAt?.toISOString() ?? null,
    decisionNote: t.decisionNote,
    discrepancyResolution: t.discrepancyResolution,
    discrepancyNote: t.discrepancyNote,
    hasUnresolvedDiscrepancy: t.status === "received" && t.discrepancyResolution === null && mismatch,
    lines,
  };
}

// ── Reads ──────────────────────────────────────────────────────────────────

export async function getTransfersForBranch(branchId: string): Promise<TransferRow[]> {
  const rows = await findTransfersForBranch(branchId);
  return rows.map(toRow);
}

export async function getAllTransfers(): Promise<TransferRow[]> {
  const rows = await findAllTransfers();
  return rows.map(toRow);
}

export async function getKioskTransferBadges(branchId: string): Promise<KioskTransferBadges> {
  const [awaitingPrepare, awaitingReceive] = await Promise.all([
    countAwaitingPrepare(branchId),
    countAwaitingReceive(branchId),
  ]);
  return { awaitingPrepare, awaitingReceive };
}

export function getPendingApprovalCount() {
  return countPendingApproval();
}

// ── Lifecycle ────────────────────────────────────────────────────────────

/** A branch requests stock from another branch (dest = requester). §9.3 step 1. */
export async function requestTransfer(
  destBranchId: string,
  input: RequestTransferSchema,
  actor: Actor,
): Promise<{ id: string }> {
  if (input.sourceBranchId === destBranchId) {
    throw new BadRequestError("Pick a different branch to request stock from.");
  }
  if (input.lines.length === 0) {
    throw new BadRequestError("Add at least one product to the request.");
  }
  const transfer = await insertTransfer(input.sourceBranchId, destBranchId, actor.clerkUserId, input.lines);
  await auditLog({
    actor,
    action: "bst.requested",
    entityType: "stock_transfer",
    entityId: transfer.id,
    after: transfer,
  });
  return { id: transfer.id };
}

async function loadInState(id: string, expected: TransferWithRelations["status"]) {
  const transfer = await findTransferById(id);
  if (!transfer) throw new NotFoundError("Stock transfer", id);
  if (transfer.status !== expected) {
    throw new InvalidStateTransitionError(
      `This transfer is "${transfer.status}", not "${expected}".`,
    );
  }
  return transfer;
}

export async function approveTransfer(id: string, actor: Actor): Promise<void> {
  const before = await loadInState(id, "requested");
  const after = await updateTransfer(id, {
    status: "approved",
    approvedBy: actor.clerkUserId,
    approvedAt: new Date(),
  });
  await auditLog({ actor, action: "bst.approved", entityType: "stock_transfer", entityId: id, before, after });
}

export async function declineTransfer(id: string, note: string | null, actor: Actor): Promise<void> {
  const before = await loadInState(id, "requested");
  const after = await updateTransfer(id, {
    status: "declined",
    approvedBy: actor.clerkUserId,
    approvedAt: new Date(),
    decisionNote: note ?? null,
  });
  await auditLog({ actor, action: "bst.declined", entityType: "stock_transfer", entityId: id, before, after });
}

export async function cancelTransfer(id: string, actor: Actor): Promise<void> {
  const before = await loadInState(id, "requested");
  const after = await updateTransfer(id, { status: "cancelled" });
  await auditLog({ actor, action: "bst.cancelled", entityType: "stock_transfer", entityId: id, before, after });
}

/**
 * Sending branch prepares actual quantities and hands off (§9.3 step 3). Posts
 * bst_out against the source branch's session; there is no separate in-transit
 * status. `actor` must be operating the source branch's kiosk.
 */
export async function prepareTransfer(input: PrepareTransferSchema, actor: Actor): Promise<void> {
  const before = await loadInState(input.transferId, "approved");
  const byLine = new Map(input.lines.map((l) => [l.lineId, l.preparedQty]));

  const { sessionId } = await openOrContinueSession(before.sourceBranchId, actor);
  const entries = [];
  for (const line of before.lines) {
    const qty = byLine.get(line.id) ?? 0;
    await updateTransferLine(line.id, { preparedQty: qty });
    if (qty > 0) {
      entries.push({
        sessionId,
        productId: line.productId,
        type: "bst_out" as InventoryEntryType,
        quantity: qty,
        bstId: before.id,
        enteredBy: actor.clerkUserId,
      });
    }
  }
  if (entries.length > 0) await insertEntries(entries);

  const after = await updateTransfer(input.transferId, {
    status: "prepared",
    preparedBy: actor.clerkUserId,
    preparedAt: new Date(),
  });
  await auditLog({ actor, action: "bst.prepared", entityType: "stock_transfer", entityId: input.transferId, before, after });
}

/**
 * Receiving branch recounts what actually arrived (§9.3 step 4). Posts bst_in
 * against the dest branch's session. A prepared≠received mismatch surfaces as an
 * unresolved discrepancy for admin review (§5.7). `actor` operates the dest kiosk.
 */
export async function receiveTransfer(input: ReceiveTransferSchema, actor: Actor): Promise<void> {
  const before = await loadInState(input.transferId, "prepared");
  const byLine = new Map(input.lines.map((l) => [l.lineId, l.receivedQty]));

  const { sessionId } = await openOrContinueSession(before.destBranchId, actor);
  const entries = [];
  for (const line of before.lines) {
    const qty = byLine.get(line.id) ?? 0;
    await updateTransferLine(line.id, { receivedQty: qty });
    if (qty > 0) {
      entries.push({
        sessionId,
        productId: line.productId,
        type: "bst_in" as InventoryEntryType,
        quantity: qty,
        bstId: before.id,
        enteredBy: actor.clerkUserId,
      });
    }
  }
  if (entries.length > 0) await insertEntries(entries);

  const after = await updateTransfer(input.transferId, {
    status: "received",
    receivedBy: actor.clerkUserId,
    receivedAt: new Date(),
  });
  await auditLog({ actor, action: "bst.received", entityType: "stock_transfer", entityId: input.transferId, before, after });
}

/**
 * Admin records how a prepared-vs-received discrepancy is booked (§5.7). We
 * record the classification and note rather than auto-posting wastage — the
 * system deliberately does not guess where the loss belongs.
 */
export async function resolveDiscrepancy(input: ResolveDiscrepancySchema, actor: Actor): Promise<void> {
  const before = await findTransferById(input.transferId);
  if (!before) throw new NotFoundError("Stock transfer", input.transferId);
  if (before.status !== "received") {
    throw new InvalidStateTransitionError("Only a received transfer can have a discrepancy resolved.");
  }
  const after = await updateTransfer(input.transferId, {
    discrepancyResolution: input.resolution,
    discrepancyNote: input.note ?? null,
  });
  await auditLog({
    actor,
    action: "bst.discrepancy_resolved",
    entityType: "stock_transfer",
    entityId: input.transferId,
    before,
    after,
  });
}
