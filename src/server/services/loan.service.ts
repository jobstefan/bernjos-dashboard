import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  findLoans,
  findLoansForEmployee,
  findLoanById,
  getOutstandingPrincipal,
  getOutstandingPrincipalMap,
  insertLoan,
  softDeleteLoan,
  updateLoan,
} from "@/server/db/loan";
import { findSavingsAccountByEmployee } from "@/server/db/savings";
import { findEmployeeByClerkId, findEmployeeById } from "@/server/db/employees";
import { auditLog } from "@/server/services/audit.service";
import {
  BadRequestError,
  InvalidStateTransitionError,
  NotFoundError,
  UnauthorizedError,
} from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type {
  LoanRow,
  LoanRepaymentRow,
  MyLoansView,
} from "@/lib/types/loan";
import type {
  AdminCreateLoanSchema,
  ApproveLoanSchema,
  CreateLoanSchema,
  DeclineLoanSchema,
} from "@/lib/validations/loan";

const { Decimal } = Prisma;

type LoanWithRelations = NonNullable<Awaited<ReturnType<typeof findLoanById>>>;
type RepaymentRow = LoanWithRelations["repayments"][number];

function computeSavingsBalance(
  account: NonNullable<Awaited<ReturnType<typeof findSavingsAccountByEmployee>>>,
): number {
  return account.transactions
    .reduce((sum, t) => sum.add(t.amount), new Decimal(0))
    .toNumber();
}

/** Available headroom = savings balance minus outstanding active loan principal. */
async function computeAvailableSavings(profileId: string): Promise<number> {
  const account = await findSavingsAccountByEmployee(profileId);
  const balance = account ? computeSavingsBalance(account) : 0;
  const outstanding = await getOutstandingPrincipal(profileId);
  return Math.max(0, balance - outstanding);
}

/** Compute installment amounts: FLOOR(amount / N) for 1..N-1, remainder for last. */
function computeInstallments(
  amount: Prisma.Decimal,
  N: number,
): Prisma.Decimal[] {
  const installment = amount
    .div(N)
    .toDecimalPlaces(0, Decimal.ROUND_FLOOR);
  const installments: Prisma.Decimal[] = [];
  let allocated = new Decimal(0);
  for (let i = 1; i <= N; i++) {
    if (i === N) {
      installments.push(amount.sub(allocated));
    } else {
      installments.push(installment);
      allocated = allocated.add(installment);
    }
  }
  return installments;
}

function toRepaymentRow(r: RepaymentRow): LoanRepaymentRow {
  return {
    id: r.id,
    installmentNo: r.installmentNo,
    amount: Number(r.amount),
    status: r.status as "pending" | "applied",
    appliedPeriodLabel: r.appliedPeriod?.periodLabel ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

function toLoanRow(loan: LoanWithRelations): LoanRow {
  const applied = loan.repayments.filter((r) => r.status === "applied");
  const pending = loan.repayments.filter((r) => r.status === "pending");
  const totalRepaid = applied.reduce((s, r) => s + Number(r.amount), 0);
  const outstandingBalance = pending.reduce((s, r) => s + Number(r.amount), 0);
  const installmentAmount =
    loan.repayments[0] != null ? Number(loan.repayments[0].amount) : 0;

  return {
    id: loan.id,
    employeeId: loan.profileId,
    employeeCode: loan.profile.employeeCode,
    employeeName: `${loan.profile.firstName} ${loan.profile.lastName}`,
    branchId: loan.branchId ?? null,
    branchName: loan.branch?.name ?? null,
    amount: Number(loan.amount),
    termPeriods: loan.termPeriods,
    installmentAmount,
    reason: loan.reason,
    status: loan.status as import("@/lib/types/loan").LoanStatus,
    decisionNote: loan.decisionNote,
    disbursedAt: loan.disbursedAt?.toISOString() ?? null,
    requestedAt: loan.createdAt.toISOString(),
    decidedAt: loan.decidedAt?.toISOString() ?? null,
    totalRepaid,
    outstandingBalance,
    repayments: loan.repayments.map(toRepaymentRow),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export async function getLoans(): Promise<LoanRow[]> {
  const loans = await findLoans();
  return loans.map(toLoanRow);
}

export async function getMyLoans(clerkUserId: string): Promise<MyLoansView> {
  const profile = await findEmployeeByClerkId(clerkUserId);
  if (!profile) return { loans: [], availableToBorrow: 0 };

  const [loans, availableToBorrow] = await Promise.all([
    findLoansForEmployee(profile.id),
    computeAvailableSavings(profile.id),
  ]);

  return {
    loans: loans.map(toLoanRow),
    availableToBorrow,
  };
}

export async function getLoansForEmployee(profileId: string): Promise<LoanRow[]> {
  const loans = await findLoansForEmployee(profileId);
  return loans.map(toLoanRow);
}

export async function getAvailableToBorrow(profileId: string): Promise<number> {
  return computeAvailableSavings(profileId);
}

/** Returns a map of profileId → outstanding pending principal for all active loans. */
export function getOutstandingPrincipalByProfile(): Promise<Record<string, number>> {
  return getOutstandingPrincipalMap();
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/** Employee requests a loan (status: pending). */
export async function requestLoan(
  input: CreateLoanSchema,
  actor: Actor,
): Promise<{ id: string }> {
  const profile = await findEmployeeByClerkId(actor.clerkUserId);
  if (!profile) throw new NotFoundError("Employee profile", actor.clerkUserId);

  const available = await computeAvailableSavings(profile.id);
  if (input.amount > available) {
    throw new BadRequestError(
      `Loan amount exceeds available savings balance. You may borrow up to ₱${available.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
    );
  }

  const loan = await insertLoan({
    profile: { connect: { id: profile.id } },
    amount: input.amount,
    termPeriods: input.termPeriods,
    reason: input.reason,
    status: "pending",
    requestedBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: "loan.requested",
    entityType: "loan",
    entityId: loan.id,
    after: loan,
  });
  return { id: loan.id };
}

/** Admin creates and immediately disburses a loan (status: active). */
export async function adminCreateLoan(
  input: AdminCreateLoanSchema,
  actor: Actor,
): Promise<{ id: string }> {
  const profile = await findEmployeeById(input.profileId);
  if (!profile) throw new NotFoundError("Employee", input.profileId);

  const available = await computeAvailableSavings(profile.id);
  if (input.amount > available) {
    throw new BadRequestError(
      `Loan amount exceeds available savings balance. Available: ₱${available.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
    );
  }

  const principal = new Decimal(input.amount);
  const installments = computeInstallments(principal, input.termPeriods);
  const now = new Date();

  const loan = await prisma.$transaction(async (tx) => {
    const created = await tx.loan.create({
      data: {
        profile: { connect: { id: profile.id } },
        branch: { connect: { id: input.branchId } },
        amount: input.amount,
        termPeriods: input.termPeriods,
        reason: input.reason,
        status: "active",
        requestedBy: actor.clerkUserId,
        decidedBy: actor.clerkUserId,
        decidedAt: now,
        disbursedBy: actor.clerkUserId,
        disbursedAt: now,
      },
    });

    await tx.loanRepayment.createMany({
      data: installments.map((amt, i) => ({
        loanId: created.id,
        installmentNo: i + 1,
        amount: amt.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      })),
    });

    return created;
  });

  await auditLog({
    actor,
    action: "loan.admin_created",
    entityType: "loan",
    entityId: loan.id,
    after: loan,
  });
  return { id: loan.id };
}

/** Admin approves an employee's pending loan request. */
export async function approveLoan(
  input: ApproveLoanSchema,
  actor: Actor,
): Promise<void> {
  const loan = await findLoanById(input.id);
  if (!loan) throw new NotFoundError("Loan", input.id);
  if (loan.status !== "pending") {
    throw new InvalidStateTransitionError("Only a pending loan can be approved.");
  }

  // Re-check the cap at approval time to protect against concurrent requests.
  const available = await computeAvailableSavings(loan.profileId);
  if (Number(loan.amount) > available) {
    throw new BadRequestError(
      `The loan amount now exceeds the available savings balance (₱${available.toLocaleString("en-PH", { minimumFractionDigits: 2 })}). The employee must re-request at a lower amount.`,
    );
  }

  const now = new Date();
  const after = await updateLoan(input.id, {
    status: "approved",
    decidedBy: actor.clerkUserId,
    decidedAt: now,
    decisionNote: input.note ?? null,
  });

  await auditLog({
    actor,
    action: "loan.approved",
    entityType: "loan",
    entityId: input.id,
    before: loan,
    after,
  });
}

/** Admin disburses an approved loan (approved → active). Creates repayment schedule. */
export async function disburseLoan(id: string, actor: Actor, branchId: string): Promise<void> {
  const loan = await findLoanById(id);
  if (!loan) throw new NotFoundError("Loan", id);
  if (loan.status !== "approved") {
    throw new InvalidStateTransitionError("Only an approved loan can be disbursed.");
  }

  const principal = new Decimal(loan.amount);
  const installments = computeInstallments(principal, loan.termPeriods);
  const now = new Date();

  // Wrap repayment creation and status update in a single transaction so they
  // can never get out of sync (e.g. repayments exist but loan stays "approved").
  const after = await prisma.$transaction(async (tx) => {
    await tx.loanRepayment.createMany({
      data: installments.map((amt, i) => ({
        loanId: loan.id,
        installmentNo: i + 1,
        amount: amt.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
      })),
    });

    return tx.loan.update({
      where: { id },
      data: {
        status: "active",
        branch: { connect: { id: branchId } },
        disbursedBy: actor.clerkUserId,
        disbursedAt: now,
      },
    });
  });

  await auditLog({
    actor,
    action: "loan.disbursed",
    entityType: "loan",
    entityId: id,
    before: loan,
    after,
  });
}

/** Admin declines a pending loan request. */
export async function declineLoan(
  input: DeclineLoanSchema,
  actor: Actor,
): Promise<void> {
  const loan = await findLoanById(input.id);
  if (!loan) throw new NotFoundError("Loan", input.id);
  if (loan.status !== "pending") {
    throw new InvalidStateTransitionError("Only a pending loan can be declined.");
  }
  const now = new Date();
  const after = await updateLoan(input.id, {
    status: "cancelled",
    decidedBy: actor.clerkUserId,
    decidedAt: now,
    decisionNote: input.reason,
  });
  await auditLog({
    actor,
    action: "loan.declined",
    entityType: "loan",
    entityId: input.id,
    before: loan,
    after,
  });
}

/** Cancel a pending (by employee or admin) or approved (admin only) loan. */
export async function cancelLoan(id: string, actor: Actor): Promise<void> {
  const loan = await findLoanById(id);
  if (!loan) throw new NotFoundError("Loan", id);

  if (loan.status === "active" || loan.status === "completed") {
    throw new InvalidStateTransitionError(
      "Active or completed loans cannot be cancelled.",
    );
  }
  if (loan.status === "cancelled") {
    throw new InvalidStateTransitionError("This loan is already cancelled.");
  }

  // Employees can only cancel their own pending loans.
  if (actor.role === "employee") {
    if (loan.status !== "pending") {
      throw new InvalidStateTransitionError(
        "You can only cancel a loan while it is pending.",
      );
    }
    const profile = await findEmployeeByClerkId(actor.clerkUserId);
    if (!profile || profile.id !== loan.profileId) {
      throw new UnauthorizedError("You can only cancel your own loan requests.");
    }
  }

  const after = await updateLoan(id, { status: "cancelled" });
  await auditLog({
    actor,
    action: "loan.cancelled",
    entityType: "loan",
    entityId: id,
    before: loan,
    after,
  });
}
