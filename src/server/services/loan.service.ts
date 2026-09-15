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
  PauseLoanSchema,
  ResumeLoanSchema,
} from "@/lib/validations/loan";
import { formatEmployeeName } from "@/lib/utils/format-name";
import { nextLoanSlipNumber } from "@/server/db/slip-number";
import { findBranchById } from "@/server/db/branches";

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
    slipNumber: loan.slipNumber ?? null,
    employeeId: loan.profileId,
    employeeCode: loan.profile.employeeCode,
    employeeName: formatEmployeeName(loan.profile.firstName, loan.profile.lastName, loan.profile.middleName),
    branchId: loan.branchId ?? null,
    branchName: loan.branch?.name ?? null,
    amount: Number(loan.amount),
    termPeriods: loan.termPeriods,
    installmentAmount,
    reason: loan.reason,
    status: loan.status as import("@/lib/types/loan").LoanStatus,
    decisionNote: loan.decisionNote,
    disbursedAt: loan.disbursedAt?.toISOString() ?? null,
    pausedAt: loan.pausedAt?.toISOString() ?? null,
    pausedBy: loan.pausedBy ?? null,
    pauseReason: loan.pauseReason ?? null,
    resumedAt: loan.resumedAt?.toISOString() ?? null,
    resumedBy: loan.resumedBy ?? null,
    requestedAt: loan.createdAt.toISOString(),
    decidedAt: loan.decidedAt?.toISOString() ?? null,
    totalRepaid,
    outstandingBalance,
    repayments: loan.repayments.map(toRepaymentRow),
    deletionRequestedAt: loan.deletionRequestedAt?.toISOString() ?? null,
    deletionRequestedBy: loan.deletionRequestedBy ?? null,
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

  if (profile.employmentStatus !== "active") {
    throw new BadRequestError(
      "Your account is inactive. You can view your history but cannot submit new requests.",
    );
  }

  const savingsAccount = await findSavingsAccountByEmployee(profile.id);
  if (savingsAccount?.frozen) {
    throw new BadRequestError(
      "Your savings account is frozen. Contact an administrator to request a loan.",
    );
  }

  const existingLoans = await findLoansForEmployee(profile.id);
  if (existingLoans.some((l) => l.status === "active" || l.status === "approved")) {
    throw new BadRequestError(
      "You already have an active loan. Fully repay it before requesting a new one.",
    );
  }

  const available = await computeAvailableSavings(profile.id);
  if (input.amount > available) {
    throw new BadRequestError(
      `Loan amount exceeds available savings balance. You may borrow up to ₱${available.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
    );
  }

  const branch = await findBranchById(input.branchId);
  const slipNumber = await nextLoanSlipNumber(branch?.code ?? null);
  const loan = await insertLoan({
    slipNumber,
    profile: { connect: { id: profile.id } },
    branch: { connect: { id: input.branchId } },
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

  const savingsAccount = await findSavingsAccountByEmployee(profile.id);
  if (savingsAccount?.frozen) {
    throw new BadRequestError(
      "This employee's savings account is frozen and cannot receive a loan.",
    );
  }

  const available = await computeAvailableSavings(profile.id);
  if (input.amount > available) {
    throw new BadRequestError(
      `Loan amount exceeds available savings balance. Available: ₱${available.toLocaleString("en-PH", { minimumFractionDigits: 2 })}.`,
    );
  }

  const principal = new Decimal(input.amount);
  const installments = computeInstallments(principal, input.termPeriods);
  const now = new Date();
  const branch = await findBranchById(input.branchId);
  const slipNumber = await nextLoanSlipNumber(branch?.code ?? null);

  const loan = await prisma.$transaction(async (tx) => {
    const created = await tx.loan.create({
      data: {
        slipNumber,
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
    branch: { connect: { id: input.branchId } },
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
export async function disburseLoan(id: string, actor: Actor): Promise<void> {
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

export async function requestLoanDeletion(id: string, actor: Actor): Promise<void> {
  const loan = await findLoanById(id);
  if (!loan) throw new NotFoundError("Loan", id);
  if (loan.deletionRequestedAt) {
    throw new BadRequestError("Deletion already requested for this loan.");
  }

  const after = await updateLoan(id, {
    deletionRequestedAt: new Date(),
    deletionRequestedBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: "loan.deletion_requested",
    entityType: "loan",
    entityId: id,
    before: loan,
    after,
  });
}

export async function cancelLoanDeletionRequest(id: string, actor: Actor): Promise<void> {
  const loan = await findLoanById(id);
  if (!loan) throw new NotFoundError("Loan", id);
  if (!loan.deletionRequestedAt) {
    throw new BadRequestError("No deletion request to cancel.");
  }
  const after = await updateLoan(id, {
    deletionRequestedAt: null,
    deletionRequestedBy: null,
  });
  await auditLog({
    actor,
    action: "loan.deletion_request_cancelled",
    entityType: "loan",
    entityId: id,
    before: loan,
    after,
  });
}

export async function deleteLoan(id: string, actor: Actor): Promise<void> {
  const loan = await findLoanById(id);
  if (!loan) throw new NotFoundError("Loan", id);
  const after = await softDeleteLoan(id);
  await auditLog({
    actor,
    action: "loan.deleted",
    entityType: "loan",
    entityId: id,
    before: loan,
    after,
  });
}

/** Admin pauses an active loan — payroll deductions are skipped until resumed. */
export async function pauseLoan(input: PauseLoanSchema, actor: Actor): Promise<void> {
  const loan = await findLoanById(input.id);
  if (!loan) throw new NotFoundError("Loan", input.id);
  if (loan.status !== "active") {
    throw new InvalidStateTransitionError("Only an active loan can be paused.");
  }
  if (loan.pausedAt !== null) {
    throw new InvalidStateTransitionError("This loan is already paused.");
  }

  const now = new Date();
  const after = await updateLoan(input.id, {
    pausedAt: now,
    pausedBy: actor.clerkUserId,
    pauseReason: input.reason ?? null,
  });

  await auditLog({
    actor,
    action: "loan.paused",
    entityType: "loan",
    entityId: input.id,
    before: loan,
    after,
  });
}

/** Admin resumes a paused active loan — deductions resume in the next payroll run. */
export async function resumeLoan(input: ResumeLoanSchema, actor: Actor): Promise<void> {
  const loan = await findLoanById(input.id);
  if (!loan) throw new NotFoundError("Loan", input.id);
  if (loan.status !== "active") {
    throw new InvalidStateTransitionError("Only an active loan can be resumed.");
  }
  if (loan.pausedAt === null) {
    throw new InvalidStateTransitionError("This loan is not currently paused.");
  }

  const now = new Date();
  const after = await updateLoan(input.id, {
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    resumedAt: now,
    resumedBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: "loan.resumed",
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
