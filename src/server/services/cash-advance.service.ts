import "server-only";
import {
  findApprovedUnappliedForEmployee,
  findCashAdvanceById,
  findCashAdvances,
  findCashAdvancesForEmployee,
  insertCashAdvance,
  softDeleteCashAdvance,
  updateCashAdvance,
} from "@/server/db/cash-advance";
import { getEmployeeByClerkUser } from "@/server/services/employee.service";
import { auditLog } from "@/server/services/audit.service";
import {
  BadRequestError,
  InvalidStateTransitionError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors/payroll";
import type {
  Actor,
  CashAdvanceFilters,
  CashAdvanceRow,
} from "@/lib/types/payroll";
import type { CreateCashAdvanceSchema } from "@/lib/validations/payroll";

export { findApprovedUnappliedForEmployee };

type CashAdvanceWithRelations = Awaited<
  ReturnType<typeof findCashAdvanceById>
>;

/** Flatten a cash-advance (with relations) into a display row. */
function toRow(advance: NonNullable<CashAdvanceWithRelations>): CashAdvanceRow {
  return {
    id: advance.id,
    employeeId: advance.employeeId,
    employeeCode: advance.employee.employeeCode,
    employeeName: `${advance.employee.firstName} ${advance.employee.lastName}`,
    amount: Number(advance.amount),
    approvedAmount:
      advance.approvedAmount != null ? Number(advance.approvedAmount) : null,
    reason: advance.reason,
    status: advance.status,
    decisionNote: advance.decisionNote,
    appliedPeriodLabel: advance.appliedPeriod?.periodLabel ?? null,
    requestedAt: advance.createdAt.toISOString(),
    decidedAt: advance.decidedAt?.toISOString() ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export async function getCashAdvances(
  filters?: CashAdvanceFilters,
): Promise<CashAdvanceRow[]> {
  const rows = await findCashAdvances(filters);
  return rows.map(toRow);
}

export async function getCashAdvancesForEmployee(
  employeeId: string,
): Promise<CashAdvanceRow[]> {
  const rows = await findCashAdvancesForEmployee(employeeId);
  return rows.map(toRow);
}

export async function getCashAdvance(id: string): Promise<CashAdvanceRow> {
  const advance = await findCashAdvanceById(id);
  if (!advance) throw new NotFoundError("Cash advance", id);
  return toRow(advance);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/** An employee submits a new cash-advance request against their own record. */
export async function requestCashAdvance(
  input: CreateCashAdvanceSchema,
  actor: Actor,
) {
  const employee = await getEmployeeByClerkUser(actor.clerkUserId);
  if (!employee) {
    throw new UnauthorizedError(
      "Your account isn't linked to an employee profile. Please contact HR.",
    );
  }

  const advance = await insertCashAdvance({
    employee: { connect: { id: employee.id } },
    amount: input.amount,
    reason: input.reason,
    status: "pending",
    requestedBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: "cash_advance.requested",
    entityType: "cash_advance",
    entityId: advance.id,
    after: advance,
  });
  return advance;
}

export async function approveCashAdvance(
  id: string,
  approvedAmount: number,
  note: string | null,
  actor: Actor,
) {
  const before = await findCashAdvanceById(id);
  if (!before) throw new NotFoundError("Cash advance", id);
  if (before.status !== "pending") {
    throw new InvalidStateTransitionError(
      "Only a pending request can be approved.",
    );
  }
  if (approvedAmount !== Number(before.amount) && !note?.trim()) {
    throw new BadRequestError(
      "A note is required when the approved amount differs from the requested amount.",
    );
  }
  const after = await updateCashAdvance(id, {
    status: "approved",
    approvedAmount,
    decidedBy: actor.clerkUserId,
    decidedAt: new Date(),
    decisionNote: note ?? null,
  });
  await auditLog({
    actor,
    action: "cash_advance.approved",
    entityType: "cash_advance",
    entityId: id,
    before,
    after,
  });
  return after;
}

export async function declineCashAdvance(
  id: string,
  reason: string,
  actor: Actor,
) {
  const before = await findCashAdvanceById(id);
  if (!before) throw new NotFoundError("Cash advance", id);
  if (before.status !== "pending") {
    throw new InvalidStateTransitionError(
      "Only a pending request can be declined.",
    );
  }
  const after = await updateCashAdvance(id, {
    status: "declined",
    decidedBy: actor.clerkUserId,
    decidedAt: new Date(),
    decisionNote: reason,
  });
  await auditLog({
    actor,
    action: "cash_advance.declined",
    entityType: "cash_advance",
    entityId: id,
    before,
    after,
  });
  return after;
}

/** An employee withdraws their own still-pending request. */
export async function cancelCashAdvance(id: string, actor: Actor) {
  const before = await findCashAdvanceById(id);
  if (!before) throw new NotFoundError("Cash advance", id);
  if (before.requestedBy !== actor.clerkUserId) {
    throw new UnauthorizedError("You can only cancel your own requests.");
  }
  if (before.status !== "pending") {
    throw new InvalidStateTransitionError(
      "Only a pending request can be cancelled.",
    );
  }
  const after = await updateCashAdvance(id, { status: "cancelled" });
  await auditLog({
    actor,
    action: "cash_advance.cancelled",
    entityType: "cash_advance",
    entityId: id,
    before,
    after,
  });
  return after;
}

/** Super-admin hard-path: soft-delete any request in any state. */
export async function deleteCashAdvance(id: string, actor: Actor) {
  const before = await findCashAdvanceById(id);
  if (!before) throw new NotFoundError("Cash advance", id);
  const after = await softDeleteCashAdvance(id);
  await auditLog({
    actor,
    action: "cash_advance.deleted",
    entityType: "cash_advance",
    entityId: id,
    before,
    after,
  });
}
