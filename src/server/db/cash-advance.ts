import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { CashAdvanceFilters } from "@/lib/types/payroll";

/** Build a Prisma where-clause from filters (always excludes soft-deleted). */
function buildWhere(filters?: CashAdvanceFilters): Prisma.CashAdvanceWhereInput {
  const where: Prisma.CashAdvanceWhereInput = { deletedAt: null };
  if (filters?.status) where.status = filters.status;
  if (filters?.profileId) where.profileId = filters.profileId;
  return where;
}

const withRelations = {
  profile: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  },
  branch: { select: { name: true } },
  appliedPeriod: { select: { id: true, periodLabel: true } },
} satisfies Prisma.CashAdvanceInclude;

export function findCashAdvances(filters?: CashAdvanceFilters) {
  return prisma.cashAdvance.findMany({
    where: buildWhere(filters),
    include: withRelations,
    orderBy: { createdAt: "desc" },
  });
}

export function findCashAdvancesForEmployee(profileId: string) {
  return prisma.cashAdvance.findMany({
    where: { profileId, deletedAt: null },
    include: withRelations,
    orderBy: { createdAt: "desc" },
  });
}

export function findCashAdvanceById(id: string) {
  return prisma.cashAdvance.findFirst({
    where: { id, deletedAt: null },
    include: withRelations,
  });
}

/** Approved advances for a profile that have not yet been applied to a run. */
export function findApprovedUnappliedForEmployee(profileId: string) {
  return prisma.cashAdvance.findMany({
    where: {
      profileId,
      status: "approved",
      appliedPeriodId: null,
      deletedAt: null,
    },
  });
}

export function insertCashAdvance(data: Prisma.CashAdvanceCreateInput) {
  return prisma.cashAdvance.create({ data });
}

export function updateCashAdvance(id: string, data: Prisma.CashAdvanceUpdateInput) {
  return prisma.cashAdvance.update({ where: { id }, data });
}

export function softDeleteCashAdvance(id: string) {
  return prisma.cashAdvance.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/** Mark a set of advances applied to a period (called during payroll calc). */
export function markCashAdvancesApplied(ids: string[], periodId: string) {
  return prisma.cashAdvance.updateMany({
    where: { id: { in: ids } },
    data: { status: "applied", appliedPeriodId: periodId, appliedAt: new Date() },
  });
}

/**
 * Reset advances previously applied to a period back to approved+unapplied, so a
 * recalculation of a (non-approved) period does not double-count or orphan them.
 */
/** Advances applied to a period (for branch attribution reporting). */
export function findAdvancesForPeriod(periodId: string) {
  return prisma.cashAdvance.findMany({
    where: { appliedPeriodId: periodId, status: "applied", deletedAt: null },
    select: { profileId: true, approvedAmount: true, amount: true, branchId: true },
  });
}

export function resetCashAdvancesForPeriod(periodId: string) {
  return prisma.cashAdvance.updateMany({
    where: { appliedPeriodId: periodId, status: "applied" },
    data: { status: "approved", appliedPeriodId: null, appliedAt: null },
  });
}
