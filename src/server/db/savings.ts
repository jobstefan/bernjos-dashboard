import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const withRelations = {
  profile: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      employmentStatus: true,
    },
  },
  transactions: {
    include: { appliedPeriod: { select: { id: true, periodLabel: true } } },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.SavingsAccountInclude;

/**
 * Accounts shown in the admin supervision list. Only active profiles appear —
 * frozen accounts (terminated/resigned/inactive) are hidden but their balances
 * are preserved and still reachable by id / profile.
 */
export function findSavingsAccounts() {
  return prisma.savingsAccount.findMany({
    where: { profile: { deletedAt: null, employmentStatus: "active" } },
    include: withRelations,
    orderBy: { profile: { lastName: "asc" } },
  });
}

export function findSavingsAccountByEmployee(profileId: string) {
  return prisma.savingsAccount.findUnique({
    where: { profileId },
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
 * Create or update a profile's account with a recurring contribution. One
 * account per profile (enforced by the unique `profileId`).
 */
export function upsertSavingsAccount(input: {
  employeeId: string;
  contributionAmount: number;
  createdBy: string;
}) {
  return prisma.savingsAccount.upsert({
    where: { profileId: input.employeeId },
    create: {
      profile: { connect: { id: input.employeeId } },
      contributionAmount: input.contributionAmount,
      createdBy: input.createdBy,
    },
    update: {
      contributionAmount: input.contributionAmount,
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

/** Accounts of non-deleted profiles — the set payroll pulls contributions from. */
export function findActiveAccountsForContribution() {
  return prisma.savingsAccount.findMany({
    where: {
      profile: { deletedAt: null },
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
