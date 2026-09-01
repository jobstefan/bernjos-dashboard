import "server-only";
import {
  findChargeById,
  findCharges,
  findChargesForEmployee,
  insertCharge,
  softDeleteCharge,
} from "@/server/db/charge";
import { findEmployeeById } from "@/server/db/employees";
import { auditLog } from "@/server/services/audit.service";
import {
  BadRequestError,
  NotFoundError,
} from "@/lib/errors/payroll";
import type { Actor, ChargeRow } from "@/lib/types/payroll";
import type { CreateChargeSchema } from "@/lib/validations/payroll";

type ChargeWithRelations = Awaited<ReturnType<typeof findChargeById>>;

function toRow(charge: NonNullable<ChargeWithRelations>): ChargeRow {
  return {
    id: charge.id,
    employeeId: charge.profileId,
    employeeCode: charge.profile.employeeCode,
    employeeName: `${charge.profile.firstName} ${charge.profile.lastName}`,
    amount: Number(charge.amount),
    reason: charge.reason,
    status: charge.status,
    appliedPeriodLabel: charge.appliedPeriod?.periodLabel ?? null,
    createdAt: charge.createdAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export async function getCharges(): Promise<ChargeRow[]> {
  const rows = await findCharges();
  return rows.map(toRow);
}

export async function getChargesForEmployee(profileId: string): Promise<ChargeRow[]> {
  const rows = await findChargesForEmployee(profileId);
  return rows.map(toRow);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/** Admin creates a charge; it is immediately pending and applied on the next payroll run. */
export async function createCharge(input: CreateChargeSchema, actor: Actor) {
  const profile = await findEmployeeById(input.profileId);
  if (!profile) throw new NotFoundError("Employee", input.profileId);

  const charge = await insertCharge({
    profile: { connect: { id: profile.id } },
    amount: input.amount,
    reason: input.reason,
    status: "pending",
    createdBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: "charge.created",
    entityType: "charge",
    entityId: charge.id,
    after: charge,
  });
  return charge;
}

/** Admin soft-deletes a pending charge. Applied charges cannot be deleted. */
export async function deleteCharge(id: string, actor: Actor) {
  const before = await findChargeById(id);
  if (!before) throw new NotFoundError("Charge", id);
  if (before.status === "applied") {
    throw new BadRequestError("Applied charges cannot be deleted.");
  }
  const after = await softDeleteCharge(id);
  await auditLog({
    actor,
    action: "charge.deleted",
    entityType: "charge",
    entityId: id,
    before,
    after,
  });
}
