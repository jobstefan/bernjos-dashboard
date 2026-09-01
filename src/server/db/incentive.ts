import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const withRelations = {
  profile: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  },
  branch: { select: { name: true } },
  period: { select: { id: true, periodLabel: true } },
} satisfies Prisma.IncentiveInclude;

export function findIncentives() {
  return prisma.incentive.findMany({
    include: withRelations,
    orderBy: { createdAt: "desc" },
  });
}

export function findPendingIncentivesForEmployee(profileId: string) {
  return prisma.incentive.findMany({
    where: { profileId, status: "pending" },
  });
}

export function findIncentiveById(id: string) {
  return prisma.incentive.findFirst({
    where: { id },
    include: withRelations,
  });
}

export function insertIncentive(data: Prisma.IncentiveCreateInput) {
  return prisma.incentive.create({ data });
}

export function updateIncentive(id: string, data: Prisma.IncentiveUpdateInput) {
  return prisma.incentive.update({ where: { id }, data });
}

export function markIncentivesApplied(ids: string[], periodId: string) {
  return prisma.incentive.updateMany({
    where: { id: { in: ids } },
    data: { status: "applied", periodId },
  });
}

/** Incentives applied to a period (for branch attribution reporting). */
export function findIncentivesForPeriod(periodId: string) {
  return prisma.incentive.findMany({
    where: { periodId, status: "applied" },
    select: { profileId: true, amount: true, branchId: true },
  });
}

export function resetIncentivesForPeriod(periodId: string) {
  return prisma.incentive.updateMany({
    where: { periodId, status: "applied" },
    data: { status: "pending", periodId: null },
  });
}
