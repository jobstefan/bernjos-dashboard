import "server-only";
import {
  findIncentives,
  findIncentiveById,
  insertIncentive,
  updateIncentive,
} from "@/server/db/incentive";
import { findEmployeeById } from "@/server/db/employees";
import { auditLog } from "@/server/services/audit.service";
import { BadRequestError, NotFoundError } from "@/lib/errors/payroll";
import type { Actor, IncentiveRow } from "@/lib/types/payroll";
import type { CreateIncentiveSchema, CancelIncentiveSchema } from "@/lib/validations/incentive";

type IncentiveWithRelations = Awaited<ReturnType<typeof findIncentiveById>>;

function toRow(incentive: NonNullable<IncentiveWithRelations>): IncentiveRow {
  return {
    id: incentive.id,
    employeeId: incentive.profileId,
    employeeCode: incentive.profile.employeeCode,
    employeeName: `${incentive.profile.firstName} ${incentive.profile.lastName}`,
    branchId: incentive.branchId ?? null,
    branchName: incentive.branch?.name ?? null,
    amount: Number(incentive.amount),
    reason: incentive.reason ?? null,
    status: incentive.status,
    appliedPeriodLabel: incentive.period?.periodLabel ?? null,
    createdAt: incentive.createdAt.toISOString(),
    cancelledAt: incentive.cancelledAt?.toISOString() ?? null,
  };
}

export async function getIncentives(): Promise<IncentiveRow[]> {
  const rows = await findIncentives();
  return rows.map(toRow);
}

export async function createIncentive(
  input: CreateIncentiveSchema,
  actor: Actor,
): Promise<{ id: string }> {
  const profile = await findEmployeeById(input.profileId);
  if (!profile) throw new NotFoundError("Employee", input.profileId);

  const incentive = await insertIncentive({
    profile: { connect: { id: input.profileId } },
    branch: { connect: { id: input.branchId } },
    amount: input.amount,
    reason: input.reason ?? null,
    status: "pending",
    createdBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: "incentive.created",
    entityType: "incentive",
    entityId: incentive.id,
    after: incentive,
  });

  return { id: incentive.id };
}

export async function cancelIncentive(
  input: CancelIncentiveSchema,
  actor: Actor,
): Promise<void> {
  const before = await findIncentiveById(input.id);
  if (!before) throw new NotFoundError("Incentive", input.id);
  if (before.status !== "pending") {
    throw new BadRequestError("Only a pending incentive can be cancelled.");
  }

  const after = await updateIncentive(input.id, {
    status: "cancelled",
    cancelledBy: actor.clerkUserId,
    cancelledAt: new Date(),
  });

  await auditLog({
    actor,
    action: "incentive.cancelled",
    entityType: "incentive",
    entityId: input.id,
    before,
    after,
  });
}
