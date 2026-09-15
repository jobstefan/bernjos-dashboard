import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const profileSelect = {
  select: { id: true, employeeCode: true, firstName: true, lastName: true, middleName: true },
} satisfies Prisma.CashAdvanceInclude["profile"];

// ── Cash advances ────────────────────────────────────────────────────────

/** Approved-but-unreleased advances for a branch (the kiosk's own list, §5.8). */
export function findReleasableAdvancesForBranch(branchId: string) {
  return prisma.cashAdvance.findMany({
    where: { branchId, status: "approved", releasedAt: null, deletedAt: null },
    include: { profile: profileSelect, branch: { select: { name: true } } },
    orderBy: { decidedAt: "asc" },
  });
}

/** Cross-branch approved-but-unreleased advances (admin follow-up view). */
export function findAllUnreleasedAdvances() {
  return prisma.cashAdvance.findMany({
    where: { status: "approved", releasedAt: null, deletedAt: null },
    include: { profile: profileSelect, branch: { select: { name: true } } },
    orderBy: { decidedAt: "asc" },
  });
}

/** Released advances not yet swept into a payroll period (undo candidates). */
export function findReleasedUnappliedAdvances() {
  return prisma.cashAdvance.findMany({
    where: { status: "approved", releasedAt: { not: null }, appliedPeriodId: null, deletedAt: null },
    include: {
      profile: profileSelect,
      branch: { select: { name: true } },
      releaseBranch: { select: { name: true } },
    },
    orderBy: { releasedAt: "desc" },
  });
}

export function findCashAdvanceBySlip(slipNumber: string) {
  return prisma.cashAdvance.findFirst({ where: { slipNumber, deletedAt: null } });
}

// ── Loans ──────────────────────────────────────────────────────────────

/** Approved loans awaiting branch disbursement/release for a branch. */
export function findReleasableLoansForBranch(branchId: string) {
  return prisma.loan.findMany({
    where: { branchId, status: "approved", deletedAt: null },
    include: { profile: profileSelect, branch: { select: { name: true } } },
    orderBy: { decidedAt: "asc" },
  });
}

export function findAllUnreleasedLoans() {
  return prisma.loan.findMany({
    where: { status: "approved", deletedAt: null },
    include: { profile: profileSelect, branch: { select: { name: true } } },
    orderBy: { decidedAt: "asc" },
  });
}

/** Disbursed loans whose repayments are all still pending & untagged (undo candidates). */
export function findReleasedUnappliedLoans() {
  return prisma.loan.findMany({
    where: {
      status: "active",
      deletedAt: null,
      repayments: { every: { status: "pending", appliedPeriodId: null } },
    },
    include: {
      profile: profileSelect,
      branch: { select: { name: true } },
      releaseBranch: { select: { name: true } },
    },
    orderBy: { disbursedAt: "desc" },
  });
}

export function findLoanBySlip(slipNumber: string) {
  return prisma.loan.findFirst({
    where: { slipNumber, deletedAt: null },
    include: { repayments: { select: { status: true, appliedPeriodId: true } } },
  });
}
