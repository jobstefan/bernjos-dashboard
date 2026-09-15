import "server-only";
import {
  findClosedSessions,
  findEntriesWithProduct,
  findEntryById,
  findSessionById,
  updateEntryQuantity,
} from "@/server/db/inventory";
import { auditLog } from "@/server/services/audit.service";
import { BadRequestError, NotFoundError } from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type { ClosedSessionRow, CorrectionEntryRow } from "@/lib/types/inventory";

export async function listClosedSessions(branchId?: string): Promise<ClosedSessionRow[]> {
  const rows = await findClosedSessions(branchId);
  return rows.map((s) => ({
    id: s.id,
    branchName: s.branch.name,
    sessionDate: s.sessionDate.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
  }));
}

export async function getSessionForCorrection(
  sessionId: string,
): Promise<{ session: ClosedSessionRow; entries: CorrectionEntryRow[] }> {
  const session = await findSessionById(sessionId);
  if (!session) throw new NotFoundError("Inventory session", sessionId);
  const entries = await findEntriesWithProduct(sessionId);
  return {
    session: {
      id: session.id,
      branchName: "",
      sessionDate: session.sessionDate.toISOString(),
      closedAt: session.closedAt?.toISOString() ?? null,
    },
    entries: entries.map((e) => ({
      id: e.id,
      productName: e.product.name,
      unit: e.product.unit,
      type: e.type,
      quantity: e.quantity,
      wastageReason: e.wastageReason,
      note: e.note,
      enteredAt: e.enteredAt.toISOString(),
    })),
  };
}

/**
 * Admin/manager corrects a single entry's quantity on a (typically closed)
 * session (§5.6). The prior value is preserved in the audit trail; downstream
 * derived figures recompute from the corrected entries automatically.
 */
export async function correctEntry(
  entryId: string,
  newQuantity: number,
  note: string | null,
  actor: Actor,
): Promise<void> {
  const before = await findEntryById(entryId);
  if (!before) throw new NotFoundError("Inventory entry", entryId);
  if (newQuantity < 0) throw new BadRequestError("Quantity can't be negative.");
  if (newQuantity === before.quantity) return;

  const after = await updateEntryQuantity(entryId, newQuantity);
  await auditLog({
    actor,
    action: "inventory.entry.corrected",
    entityType: "inventory_entry",
    entityId: entryId,
    before: { quantity: before.quantity, type: before.type },
    after: { quantity: after.quantity, note },
  });
}
