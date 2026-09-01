import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { LoanFilters } from "@/lib/types/loan";

function buildWhere(filters?: LoanFilters): Prisma.LoanWhereInput {
  const where: Prisma.LoanWhereInput = { deletedAt: null };
  if (filters?.status) where.status = filters.status;
  if (filters?.profileId) where.profileId = filters.profileId;
  return where;
}

const withRelations = {
  profile: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  },
  branch: { select: { name: true } },
  repayments: {
    orderBy: { installmentNo: "asc" as const },
    include: {
      appliedPeriod: { select: { periodLabel: true } },
    },
  },
} satisfies Prisma.LoanInclude;

export function findLoans(filters?: LoanFilters) {
  return prisma.loan.findMany({
    where: buildWhere(filters),
    include: withRelations,
    orderBy: { createdAt: "desc" },
  });
}

export function findLoansForEmployee(profileId: string) {
  return prisma.loan.findMany({
    where: { profileId, deletedAt: null },
    include: withRelations,
    orderBy: { createdAt: "desc" },
  });
}

export function findLoanById(id: string) {
  return prisma.loan.findFirst({
    where: { id, deletedAt: null },
    include: withRelations,
  });
}

/**
 * Returns exactly ONE pending repayment per active loan for a given profile —
 * the lowest-numbered installment that has not yet been tagged to a period.
 * This ensures only one installment is deducted per payroll run, not the whole loan.
 */
export async function findPendingRepaymentsForEmployee(profileId: string) {
  const activeLoans = await prisma.loan.findMany({
    where: { profileId, status: "active", deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const results: Awaited<ReturnType<typeof prisma.loanRepayment.findFirst>>[] = [];
  for (const loan of activeLoans) {
    const next = await prisma.loanRepayment.findFirst({
      where: {
        loanId: loan.id,
        status: "pending",
        appliedPeriodId: { equals: null },
      },
      orderBy: { installmentNo: "asc" },
    });
    if (next) results.push(next);
  }
  return results.filter((r) => r !== null);
}

export function insertLoan(data: Prisma.LoanCreateInput) {
  return prisma.loan.create({ data });
}

export function updateLoan(id: string, data: Prisma.LoanUpdateInput) {
  return prisma.loan.update({ where: { id }, data });
}

export function softDeleteLoan(id: string) {
  return prisma.loan.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export function insertRepayments(
  rows: { loanId: string; installmentNo: number; amount: Prisma.Decimal }[],
) {
  return prisma.loanRepayment.createMany({ data: rows });
}

/** Tag repayments with appliedPeriodId during payroll draft calc (status stays "pending"). */
export function markRepaymentsTagged(ids: string[], periodId: string) {
  return prisma.loanRepayment.updateMany({
    where: { id: { in: ids } },
    data: { appliedPeriodId: periodId },
  });
}

/** Finalize repayments to "applied" when the payroll period is approved. */
export function finalizeRepaymentsForPeriod(periodId: string) {
  return prisma.loanRepayment.updateMany({
    where: { appliedPeriodId: periodId, status: "pending" },
    data: { status: "applied", appliedAt: new Date() },
  });
}

/** Reset repayments tagged to a period back to untagged pending (for recalculation). */
export function resetRepaymentsForPeriod(periodId: string) {
  return prisma.loanRepayment.updateMany({
    where: { appliedPeriodId: periodId, status: "pending" },
    data: { appliedPeriodId: null },
  });
}

/** Find active loans whose every repayment is now applied (for auto-completion). */
export async function findFullyRepaidLoansInPeriod(periodId: string) {
  return prisma.loan.findMany({
    where: {
      status: "active",
      deletedAt: null,
      repayments: {
        none: { status: "pending" },
        some: { appliedPeriodId: periodId },
      },
    },
    select: { id: true },
  });
}

/** Outstanding principal: sum of pending repayment amounts for active loans of an employee. */
export async function getOutstandingPrincipal(profileId: string): Promise<number> {
  const result = await prisma.loanRepayment.aggregate({
    _sum: { amount: true },
    where: {
      status: "pending",
      loan: { profileId, status: "active", deletedAt: null },
    },
  });
  return Number(result._sum.amount ?? 0);
}

/** Returns a map of profileId → sum of pending repayment amounts across all active loans. */
export async function getOutstandingPrincipalMap(): Promise<Record<string, number>> {
  const loans = await prisma.loan.findMany({
    where: { status: "active", deletedAt: null },
    select: {
      profileId: true,
      repayments: {
        where: { status: "pending" },
        select: { amount: true },
      },
    },
  });
  const map: Record<string, number> = {};
  for (const loan of loans) {
    const outstanding = loan.repayments.reduce((s, r) => s + Number(r.amount), 0);
    map[loan.profileId] = (map[loan.profileId] ?? 0) + outstanding;
  }
  return map;
}
