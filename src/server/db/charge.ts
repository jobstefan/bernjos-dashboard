import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const withRelations = {
  profile: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  },
  branch: { select: { id: true, name: true } },
  appliedPeriod: { select: { id: true, periodLabel: true } },
} satisfies Prisma.ChargeInclude;

export function findCharges() {
  return prisma.charge.findMany({
    where: { deletedAt: null },
    include: withRelations,
    orderBy: { createdAt: "desc" },
  });
}

export function findChargesForEmployee(profileId: string) {
  return prisma.charge.findMany({
    where: { profileId, deletedAt: null },
    include: withRelations,
    orderBy: { createdAt: "desc" },
  });
}

export function findChargeById(id: string) {
  return prisma.charge.findFirst({
    where: { id, deletedAt: null },
    include: withRelations,
  });
}

/** Pending (unapplied) charges for a profile — used during payroll calculation. */
export function findPendingChargesForEmployee(profileId: string) {
  return prisma.charge.findMany({
    where: { profileId, status: "pending", appliedPeriodId: null, deletedAt: null },
  });
}

export function insertCharge(data: Prisma.ChargeCreateInput) {
  return prisma.charge.create({ data });
}

export function updateCharge(id: string, data: Prisma.ChargeUpdateInput) {
  return prisma.charge.update({ where: { id }, data });
}

export function softDeleteCharge(id: string) {
  return prisma.charge.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/** Mark a set of charges as applied to a period (called during payroll calc). */
export function markChargesApplied(ids: string[], periodId: string) {
  return prisma.charge.updateMany({
    where: { id: { in: ids } },
    data: { status: "applied", appliedPeriodId: periodId, appliedAt: new Date() },
  });
}

/**
 * Reset charges previously applied to a period back to pending, so a
 * recalculation of a (non-approved) period doesn't double-count them.
 */
/** All charges applied to a period (for branch attribution reporting). */
export function findChargesForPeriod(periodId: string) {
  return prisma.charge.findMany({
    where: { appliedPeriodId: periodId, status: "applied", deletedAt: null },
    select: { profileId: true, amount: true, branchId: true },
  });
}

export function resetChargesForPeriod(periodId: string) {
  return prisma.charge.updateMany({
    where: { appliedPeriodId: periodId, status: "applied" },
    data: { status: "pending", appliedPeriodId: null, appliedAt: null },
  });
}
