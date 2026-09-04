import "server-only";
import {
  findAbsenceRequestById,
  findOverlappingAbsenceRequest,
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

type AbsenceRequestWithProfile = Awaited<
  ReturnType<typeof findAbsenceRequestById>
>;

export interface AbsenceRequestRow {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  /** Start date (or the only date for single-day requests). YYYY-MM-DD */
  startDate: string;
  /** End date of the range. Null means same as startDate (single-day). YYYY-MM-DD */
  endDate: string | null;
  reason: string | null;
  status: AbsenceRequestStatus;
  decisionNote: string | null;
  requestedAt: string;
  decidedAt: string | null;
}

function toRow(req: NonNullable<AbsenceRequestWithProfile>): AbsenceRequestRow {
  return {
    id: req.id,
    employeeId: req.profileId,
    employeeCode: req.profile.employeeCode,
    employeeName: `${req.profile.firstName} ${req.profile.lastName}`,
    startDate: req.date.toISOString().slice(0, 10),
    endDate: req.endDate?.toISOString().slice(0, 10) ?? null,
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
  profileId: string,
): Promise<AbsenceRequestRow[]> {
  const rows = await findAbsenceRequestsForEmployee(profileId);
  return rows.map(toRow);
}

/** Returns active (pending or approved) requests for a date, keyed by profileId. */
export async function getActiveAbsencesForDate(
  date: Date,
): Promise<Map<string, AbsenceRequestRow>> {
  const all = await findAbsenceRequestsForDate(date);
  const active = all.filter((r) => r.status === "pending" || r.status === "approved");
  return new Map(active.map((r) => [r.profileId, toRow(r)]));
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/** Profile submits a request for their own absence on a given date or range. */
export async function requestAbsence(
  startDateIso: string,
  endDateIso: string,
  reason: string | null,
  actor: Actor,
) {
  const profile = await getEmployeeByClerkUser(actor.clerkUserId);
  if (!profile) {
    throw new UnauthorizedError(
      "Your account isn't linked to an employee profile. Please contact HR.",
    );
  }

  const startDate = new Date(`${startDateIso}T00:00:00Z`);
  const endDate = new Date(`${endDateIso}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  if (startDate <= today) {
    throw new BadRequestError(
      "Absence requests must be for a future date, not today or a past date.",
    );
  }

  if (endDate < startDate) {
    throw new BadRequestError("End date must be on or after the start date.");
  }

  const existing = await findOverlappingAbsenceRequest(
    profile.id,
    startDate,
    endDate,
  );
  if (existing) {
    throw new BadRequestError(
      "You already have an active absence request that overlaps with the selected dates.",
    );
  }

  const req = await insertAbsenceRequest({
    profile: { connect: { id: profile.id } },
    date: startDate,
    endDate: endDateIso === startDateIso ? null : endDate,
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

/** Admin manually creates an absence request for any profile (auto-approved). */
export async function createAbsenceRequestAdmin(
  profileId: string,
  startDateIso: string,
  endDateIso: string,
  reason: string | null,
  actor: Actor,
) {
  const startDate = new Date(`${startDateIso}T00:00:00Z`);
  const endDate = new Date(`${endDateIso}T00:00:00Z`);

  if (endDate < startDate) {
    throw new BadRequestError("End date must be on or after the start date.");
  }

  const existing = await findOverlappingAbsenceRequest(
    profileId,
    startDate,
    endDate,
  );
  if (existing) {
    throw new BadRequestError(
      "This employee already has an active absence request that overlaps with the selected dates.",
    );
  }

  const req = await insertAbsenceRequest({
    profile: { connect: { id: profileId } },
    date: startDate,
    endDate: endDateIso === startDateIso ? null : endDate,
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

export async function approveAbsenceRequest(
  id: string,
  actor: Actor,
  startDateIso: string,
  endDateIso: string,
  note?: string,
) {
  const before = await findAbsenceRequestById(id);
  if (!before) throw new NotFoundError("Absence request", id);
  if (before.status !== "pending") {
    throw new InvalidStateTransitionError("Only a pending request can be approved.");
  }

  const startDate = new Date(`${startDateIso}T00:00:00Z`);
  const endDate = new Date(`${endDateIso}T00:00:00Z`);

  if (endDate < startDate) {
    throw new BadRequestError("End date must be on or after the start date.");
  }

  const overlap = await findOverlappingAbsenceRequest(
    before.profileId,
    startDate,
    endDate,
    id,
  );
  if (overlap) {
    throw new BadRequestError(
      "The approved date range overlaps with another active absence request for this employee.",
    );
  }

  const after = await updateAbsenceRequest(id, {
    status: "approved",
    date: startDate,
    endDate: endDateIso === startDateIso ? null : endDate,
    decisionNote: note ?? null,
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

/** Profile cancels their own pending request. */
export async function cancelAbsenceRequest(id: string, actor: Actor) {
  const before = await findAbsenceRequestById(id);
  if (!before) throw new NotFoundError("Absence request", id);
  if (before.requestedBy !== actor.clerkUserId) {
    throw new UnauthorizedError("You can only cancel your own requests.");
  }
  if (before.status !== "pending") {
    throw new InvalidStateTransitionError("Only a pending request can be cancelled.");
  }
  const after = await updateAbsenceRequest(id, { status: "cancelled" });
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
