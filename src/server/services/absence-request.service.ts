import "server-only";
import {
  findAbsenceRequestById,
  findAbsenceRequestByEmployeeDate,
  findAbsenceRequests,
  findAbsenceRequestsForDate,
  findAbsenceRequestsForEmployee,
  insertAbsenceRequest,
  removeAbsenceRequest,
  updateAbsenceRequest,
} from "@/server/db/absence-request";
import { getEmployeeByClerkUser } from "@/server/services/employee.service";
import { auditLog } from "@/server/services/audit.service";
import {
  BadRequestError,
  InvalidStateTransitionError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type { AbsenceRequestStatus } from "@/generated/prisma/enums";

type AbsenceRequestWithEmployee = Awaited<
  ReturnType<typeof findAbsenceRequestById>
>;

export interface AbsenceRequestRow {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  date: string;
  reason: string | null;
  status: AbsenceRequestStatus;
  decisionNote: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

function toRow(req: NonNullable<AbsenceRequestWithEmployee>): AbsenceRequestRow {
  return {
    id: req.id,
    employeeId: req.employeeId,
    employeeCode: req.employee.employeeCode,
    employeeName: `${req.employee.firstName} ${req.employee.lastName}`,
    date: req.date.toISOString().slice(0, 10),
    reason: req.reason,
    status: req.status,
    decisionNote: req.decisionNote,
    requestedAt: req.createdAt.toISOString(),
    decidedAt: req.decidedAt?.toISOString() ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export async function getAbsenceRequests(filters?: {
  status?: AbsenceRequestStatus;
  employeeId?: string;
  date?: Date;
}): Promise<AbsenceRequestRow[]> {
  const rows = await findAbsenceRequests(filters);
  return rows.map(toRow);
}

export async function getAbsenceRequestsForEmployee(
  employeeId: string,
): Promise<AbsenceRequestRow[]> {
  const rows = await findAbsenceRequestsForEmployee(employeeId);
  return rows.map(toRow);
}

/** Returns active (pending or approved) requests for a date, keyed by employeeId. */
export async function getActiveAbsencesForDate(
  date: Date,
): Promise<Map<string, AbsenceRequestRow>> {
  const all = await findAbsenceRequestsForDate(date);
  const active = all.filter((r) => r.status !== "declined");
  return new Map(active.map((r) => [r.employeeId, toRow(r)]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/** Employee submits a request for their own absence on a given date. */
export async function requestAbsence(
  dateIso: string,
  reason: string | null,
  actor: Actor,
) {
  const employee = await getEmployeeByClerkUser(actor.clerkUserId);
  if (!employee) {
    throw new UnauthorizedError(
      "Your account isn't linked to an employee profile. Please contact HR.",
    );
  }

  const date = new Date(`${dateIso}T00:00:00Z`);
  const existing = await findAbsenceRequestByEmployeeDate(employee.id, date);
  if (existing && existing.status !== "declined") {
    throw new BadRequestError(
      "You already have an active absence request for this date.",
    );
  }

  const req = await insertAbsenceRequest({
    employee: { connect: { id: employee.id } },
    date,
    reason: reason ?? null,
    status: "pending",
    requestedBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: "absence_request.requested",
    entityType: "absence_request",
    entityId: req.id,
    after: req,
  });
  return toRow(req);
}

/** Admin manually creates an absence request for any employee (auto-approved). */
export async function createAbsenceRequestAdmin(
  employeeId: string,
  dateIso: string,
  reason: string | null,
  actor: Actor,
) {
  const date = new Date(`${dateIso}T00:00:00Z`);
  const existing = await findAbsenceRequestByEmployeeDate(employeeId, date);
  if (existing && existing.status !== "declined") {
    throw new BadRequestError(
      "This employee already has an active absence request for this date.",
    );
  }

  const req = await insertAbsenceRequest({
    employee: { connect: { id: employeeId } },
    date,
    reason: reason ?? null,
    status: "approved",
    requestedBy: actor.clerkUserId,
    decidedBy: actor.clerkUserId,
    decidedAt: new Date(),
  });

  await auditLog({
    actor,
    action: "absence_request.created_by_admin",
    entityType: "absence_request",
    entityId: req.id,
    after: req,
  });
  return toRow(req);
}

export async function approveAbsenceRequest(id: string, actor: Actor) {
  const before = await findAbsenceRequestById(id);
  if (!before) throw new NotFoundError("Absence request", id);
  if (before.status !== "pending") {
    throw new InvalidStateTransitionError("Only a pending request can be approved.");
  }
  const after = await updateAbsenceRequest(id, {
    status: "approved",
    decidedBy: actor.clerkUserId,
    decidedAt: new Date(),
  });
  await auditLog({
    actor,
    action: "absence_request.approved",
    entityType: "absence_request",
    entityId: id,
    before,
    after,
  });
  return toRow(after);
}

export async function declineAbsenceRequest(
  id: string,
  note: string | null,
  actor: Actor,
) {
  const before = await findAbsenceRequestById(id);
  if (!before) throw new NotFoundError("Absence request", id);
  if (before.status !== "pending") {
    throw new InvalidStateTransitionError("Only a pending request can be declined.");
  }
  const after = await updateAbsenceRequest(id, {
    status: "declined",
    decidedBy: actor.clerkUserId,
    decidedAt: new Date(),
    decisionNote: note ?? null,
  });
  await auditLog({
    actor,
    action: "absence_request.declined",
    entityType: "absence_request",
    entityId: id,
    before,
    after,
  });
  return toRow(after);
}

/** Admin hard-deletes any absence request regardless of status. */
export async function deleteAbsenceRequest(id: string, actor: Actor) {
  const before = await findAbsenceRequestById(id);
  if (!before) throw new NotFoundError("Absence request", id);
  await removeAbsenceRequest(id);
  await auditLog({
    actor,
    action: "absence_request.deleted",
    entityType: "absence_request",
    entityId: id,
    before,
  });
}

/** Employee cancels their own pending request. */
export async function cancelAbsenceRequest(id: string, actor: Actor) {
  const before = await findAbsenceRequestById(id);
  if (!before) throw new NotFoundError("Absence request", id);
  if (before.requestedBy !== actor.clerkUserId) {
    throw new UnauthorizedError("You can only cancel your own requests.");
  }
  if (before.status !== "pending") {
    throw new InvalidStateTransitionError("Only a pending request can be cancelled.");
  }
  const after = await updateAbsenceRequest(id, { status: "declined" });
  await auditLog({
    actor,
    action: "absence_request.cancelled",
    entityType: "absence_request",
    entityId: id,
    before,
    after,
  });
  return toRow(after);
}
