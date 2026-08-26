import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  findSavingsAccountByEmployee,
  findSavingsAccounts,
  insertSavingsTransaction,
  upsertSavingsAccount as upsertSavingsAccountRow,
} from "@/server/db/savings";
import { findEmployeeById } from "@/server/db/employees";
import { auditLog } from "@/server/services/audit.service";
import { BadRequestError, NotFoundError } from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type {
  EmployeeSavings,
  SavingsAccountRow,
  SavingsTransactionRow,
  SavingsTransactionType,
} from "@/lib/types/savings";
import type {
  SavingsAdjustmentSchema,
  UpsertSavingsAccountSchema,
} from "@/lib/validations/savings";

const { Decimal } = Prisma;

type AccountWithRelations = NonNullable<
  Awaited<ReturnType<typeof findSavingsAccountByEmployee>>
>;
type TransactionWithPeriod = AccountWithRelations["transactions"][number];

/** Balance = sum of signed ledger amounts (contributions +, withdrawals −). */
function computeBalance(account: AccountWithRelations): number {
  return account.transactions
    .reduce((sum, t) => sum.add(t.amount), new Decimal(0))
    .toNumber();
}

function toTransactionRow(t: TransactionWithPeriod): SavingsTransactionRow {
  return {
    id: t.id,
    type: t.type as SavingsTransactionType,
    amount: Number(t.amount),
    note: t.note,
    appliedPeriodLabel: t.appliedPeriod?.periodLabel ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

function toAccountRow(account: AccountWithRelations): SavingsAccountRow {
  return {
    accountId: account.id,
    employeeId: account.profileId,
    employeeCode: account.profile.employeeCode,
    employeeName: `${account.profile.firstName} ${account.profile.lastName}`,
    contributionAmount: Number(account.contributionAmount),
    frozen: account.profile.employmentStatus !== "active",
    balance: computeBalance(account),
    lastActivityAt: account.transactions[0]?.createdAt.toISOString() ?? null,
    transactions: account.transactions.map(toTransactionRow),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export async function getSavingsAccounts(): Promise<SavingsAccountRow[]> {
  const accounts = await findSavingsAccounts();
  return accounts.map(toAccountRow);
}

/** The self-service view for one profile (account + full ledger). Returns null
 * if the profile has no savings account yet. */
export async function getSavingsForEmployee(
  profileId: string,
): Promise<EmployeeSavings | null> {
  const account = await findSavingsAccountByEmployee(profileId);
  if (!account) return null;
  return {
    employeeId: account.profileId,
    employeeCode: account.profile.employeeCode,
    employeeName: `${account.profile.firstName} ${account.profile.lastName}`,
    contributionAmount: Number(account.contributionAmount),
    frozen: account.profile.employmentStatus !== "active",
    balance: computeBalance(account),
    transactions: account.transactions.map(toTransactionRow),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations (admin-only; enforced by the action layer)
// ─────────────────────────────────────────────────────────────────────────────

/** Create or update a profile's recurring savings contribution. */
export async function upsertSavingsAccount(
  input: UpsertSavingsAccountSchema,
  actor: Actor,
) {
  const profile = await findEmployeeById(input.employeeId);
  if (!profile) throw new NotFoundError("Employee", input.employeeId);
  if (profile.employmentStatus !== "active") {
    throw new BadRequestError(
      "This savings account is frozen because the employee is no longer active.",
    );
  }

  const before = await findSavingsAccountByEmployee(input.employeeId);
  const account = await upsertSavingsAccountRow({
    employeeId: input.employeeId,
    contributionAmount: input.contributionAmount,
    createdBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: before ? "savings.account.updated" : "savings.account.created",
    entityType: "savings_account",
    entityId: account.id,
    before,
    after: account,
  });
  return account;
}

/**
 * Record an admin-initiated withdrawal or balance adjustment. Withdrawals are
 * stored as a negative ledger amount and may not overdraw the balance;
 * adjustments are a positive credit correction.
 */
export async function recordSavingsAdjustment(
  input: SavingsAdjustmentSchema,
  actor: Actor,
) {
  const account = await findSavingsAccountByEmployee(input.employeeId);
  if (!account) {
    throw new NotFoundError("Savings account for employee", input.employeeId);
  }

  const balance = computeBalance(account);
  if (input.type === "withdrawal" && input.amount > balance) {
    throw new BadRequestError(
      "Withdrawal exceeds the available savings balance.",
    );
  }

  const signedAmount = input.type === "withdrawal" ? -input.amount : input.amount;
  const transaction = await insertSavingsTransaction({
    accountId: account.id,
    type: input.type,
    amount: signedAmount,
    note: input.note ?? null,
    appliedPeriodId: null,
    createdBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: `savings.${input.type}`,
    entityType: "savings_account",
    entityId: account.id,
    after: transaction,
  });
  return toAccountRow({ ...account, transactions: [transaction as typeof account.transactions[number], ...account.transactions] });
}

/** Admin view of one employee's account (for the savings detail page). */
export async function getSavingsAccount(
  accountId: string,
): Promise<SavingsAccountRow | null> {
  const { findSavingsAccountById } = await import("@/server/db/savings");
  const account = await findSavingsAccountById(accountId);
  if (!account) return null;
  return toAccountRow(account);
}

/** Self-service: get the savings for the profile linked to a Clerk user id. */
export async function getMySavings(
  clerkUserId: string,
): Promise<EmployeeSavings | null> {
  const { findEmployeeByClerkId } = await import("@/server/db/employees");
  const profile = await findEmployeeByClerkId(clerkUserId);
  if (!profile) return null;
  return getSavingsForEmployee(profile.id);
}
