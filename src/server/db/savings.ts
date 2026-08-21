import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const withRelations = {
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  },
  transactions: {
    include: { appliedPeriod: { select: { id: true, periodLabel: true } } },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.SavingsAccountInclude;

export function findSavingsAccounts() {
  return prisma.savingsAccount.findMany({
    where: { employee: { deletedAt: null } },
    include: withRelations,
    orderBy: { employee: { lastName: "asc" } },
  });
}

export function findSavingsAccountByEmployee(employeeId: string) {
  return prisma.savingsAccount.findUnique({
    where: { employeeId },
    include: withRelations,
  });
}

export function findSavingsAccountById(id: string) {
  return prisma.savingsAccount.findUnique({
    where: { id },
    include: withRelations,
  });
}

/**
 * Create or update an employee's account with a recurring contribution + active
 * flag. One account per employee (enforced by the unique `employeeId`).
 */
export function upsertSavingsAccount(input: {
  employeeId: string;
  contributionAmount: number;
  active: boolean;
  createdBy: string;
}) {
  return prisma.savingsAccount.upsert({
    where: { employeeId: input.employeeId },
    create: {
      employee: { connect: { id: input.employeeId } },
      contributionAmount: input.contributionAmount,
      active: input.active,
      createdBy: input.createdBy,
    },
    update: {
      contributionAmount: input.contributionAmount,
      active: input.active,
    },
    include: withRelations,
  });
}

export function insertSavingsTransaction(input: {
  accountId: string;
  type: string;
  amount: Prisma.Decimal | number;
  note: string | null;
  appliedPeriodId: string | null;
  createdBy: string;
}) {
  return prisma.savingsTransaction.create({
    data: {
      accountId: input.accountId,
      type: input.type,
      amount: input.amount,
      note: input.note,
      appliedPeriodId: input.appliedPeriodId,
      createdBy: input.createdBy,
    },
  });
}

/** Active accounts with a positive contribution — the set payroll pulls from. */
export function findActiveAccountsForContribution() {
  return prisma.savingsAccount.findMany({
    where: {
      active: true,
      contributionAmount: { gt: 0 },
      employee: { deletedAt: null },
    },
  });
}

/**
 * Remove the contribution ledger rows a payroll run created for a period, so a
 * recalculation of a (non-approved) period never double-counts them. Mirrors
 * `resetCashAdvancesForPeriod`.
 */
export function resetSavingsContributionsForPeriod(periodId: string) {
  return prisma.savingsTransaction.deleteMany({
    where: { appliedPeriodId: periodId, type: "contribution" },
  });
}
