import "server-only";
import { prisma } from "@/lib/db";
import {
  findAllUnreleasedAdvances,
  findAllUnreleasedLoans,
  findCashAdvanceBySlip,
  findLoanBySlip,
  findReleasableAdvancesForBranch,
  findReleasableLoansForBranch,
  findReleasedUnappliedAdvances,
  findReleasedUnappliedLoans,
} from "@/server/db/inventory-release";
import { updateCashAdvance, findCashAdvanceById } from "@/server/db/cash-advance";
import { updateLoan, findLoanById } from "@/server/db/loan";
import { disburseLoan } from "@/server/services/loan.service";
import { auditLog } from "@/server/services/audit.service";
import { BadRequestError, InvalidStateTransitionError, NotFoundError } from "@/lib/errors/payroll";
import { formatEmployeeName } from "@/lib/utils/format-name";
import type { Actor } from "@/lib/types/payroll";
import type { ReleasableItem, ReleasedRow, UnreleasedRow } from "@/lib/types/inventory";

type ProfileLite = {
  employeeCode: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
};

function nameOf(p: ProfileLite): string {
  return formatEmployeeName(p.firstName, p.lastName, p.middleName);
}

function daysSince(date: Date | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

// ── Kiosk: list releasable for a branch ─────────────────────────────────────

export async function listReleasableForBranch(branchId: string): Promise<ReleasableItem[]> {
  const [advances, loans] = await Promise.all([
    findReleasableAdvancesForBranch(branchId),
    findReleasableLoansForBranch(branchId),
  ]);
  const items: ReleasableItem[] = [
    ...advances.map((a) => ({
      kind: "advance" as const,
      id: a.id,
      slipNumber: a.slipNumber,
      employeeName: nameOf(a.profile),
      amount: Number(a.approvedAmount ?? a.amount),
      branchName: a.branch?.name ?? null,
      decidedAt: a.decidedAt?.toISOString() ?? null,
    })),
    ...loans.map((l) => ({
      kind: "loan" as const,
      id: l.id,
      slipNumber: l.slipNumber,
      employeeName: nameOf(l.profile),
      amount: Number(l.amount),
      branchName: l.branch?.name ?? null,
      decidedAt: l.decidedAt?.toISOString() ?? null,
    })),
  ];
  return items.sort((a, b) => (a.decidedAt ?? "").localeCompare(b.decidedAt ?? ""));
}

// ── Kiosk: release by slip code (single tap; code is verification, §5.8) ─────

export async function releaseBySlip(
  slipNumber: string,
  branchId: string,
  actor: Actor,
): Promise<{ kind: "advance" | "loan" }> {
  const code = slipNumber.trim().toUpperCase();
  if (code.startsWith("CA-")) {
    await releaseAdvance(code, branchId, actor);
    return { kind: "advance" };
  }
  if (code.startsWith("LN-")) {
    await releaseLoan(code, branchId, actor);
    return { kind: "loan" };
  }
  throw new BadRequestError("Unrecognised slip code. Expected a CA- or LN- code.");
}

async function releaseAdvance(slipNumber: string, branchId: string, actor: Actor): Promise<void> {
  const advance = await findCashAdvanceBySlip(slipNumber);
  if (!advance) throw new NotFoundError("Cash advance", slipNumber);
  if (advance.status !== "approved") {
    throw new InvalidStateTransitionError("Only an approved advance can be released.");
  }
  if (advance.releasedAt) throw new BadRequestError("This advance is already released.");

  const after = await updateCashAdvance(advance.id, {
    releasedAt: new Date(),
    releasedBy: actor.clerkUserId,
    releaseBranch: { connect: { id: branchId } },
  });
  await auditLog({
    actor,
    action: "inventory.cash_advance.released",
    entityType: "cash_advance",
    entityId: advance.id,
    before: advance,
    after,
  });
}

async function releaseLoan(slipNumber: string, branchId: string, actor: Actor): Promise<void> {
  const loan = await findLoanBySlip(slipNumber);
  if (!loan) throw new NotFoundError("Loan", slipNumber);
  if (loan.status !== "approved") {
    throw new InvalidStateTransitionError(
      loan.status === "active"
        ? "This loan is already released."
        : "Only an approved loan can be released.",
    );
  }
  // disburseLoan flips approved → active, creates the repayment schedule, and
  // audits the disbursement. The kiosk release additionally records the branch.
  await disburseLoan(loan.id, actor);
  await updateLoan(loan.id, { releaseBranch: { connect: { id: branchId } } });
  await auditLog({
    actor,
    action: "inventory.loan.released",
    entityType: "loan",
    entityId: loan.id,
    after: { releaseBranchId: branchId },
  });
}

// ── Admin: cross-branch visibility ──────────────────────────────────────────

export async function listUnreleased(): Promise<UnreleasedRow[]> {
  const [advances, loans] = await Promise.all([
    findAllUnreleasedAdvances(),
    findAllUnreleasedLoans(),
  ]);
  const rows: UnreleasedRow[] = [
    ...advances.map((a) => ({
      kind: "advance" as const,
      id: a.id,
      slipNumber: a.slipNumber,
      employeeName: nameOf(a.profile),
      amount: Number(a.approvedAmount ?? a.amount),
      branchName: a.branch?.name ?? null,
      decidedAt: a.decidedAt?.toISOString() ?? null,
      ageDays: daysSince(a.decidedAt),
    })),
    ...loans.map((l) => ({
      kind: "loan" as const,
      id: l.id,
      slipNumber: l.slipNumber,
      employeeName: nameOf(l.profile),
      amount: Number(l.amount),
      branchName: l.branch?.name ?? null,
      decidedAt: l.decidedAt?.toISOString() ?? null,
      ageDays: daysSince(l.decidedAt),
    })),
  ];
  return rows.sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));
}

export async function listReleasedUnapplied(): Promise<ReleasedRow[]> {
  const [advances, loans] = await Promise.all([
    findReleasedUnappliedAdvances(),
    findReleasedUnappliedLoans(),
  ]);
  return [
    ...advances.map((a) => ({
      kind: "advance" as const,
      id: a.id,
      slipNumber: a.slipNumber,
      employeeName: nameOf(a.profile),
      amount: Number(a.approvedAmount ?? a.amount),
      branchName: a.branch?.name ?? null,
      releaseBranchName: a.releaseBranch?.name ?? null,
      releasedAt: a.releasedAt?.toISOString() ?? null,
    })),
    ...loans.map((l) => ({
      kind: "loan" as const,
      id: l.id,
      slipNumber: l.slipNumber,
      employeeName: nameOf(l.profile),
      amount: Number(l.amount),
      branchName: l.branch?.name ?? null,
      releaseBranchName: l.releaseBranch?.name ?? null,
      releasedAt: l.disbursedAt?.toISOString() ?? null,
    })),
  ].sort((a, b) => (b.releasedAt ?? "").localeCompare(a.releasedAt ?? ""));
}

// ── Admin: undo a mistaken release (only while unapplied to payroll, §5.8) ──

export async function undoAdvanceRelease(id: string, actor: Actor): Promise<void> {
  const advance = await findCashAdvanceById(id);
  if (!advance) throw new NotFoundError("Cash advance", id);
  if (!advance.releasedAt) throw new BadRequestError("This advance isn't released.");
  if (advance.appliedPeriodId) {
    throw new InvalidStateTransitionError(
      "This advance has already been swept into a payroll period and can no longer be un-released.",
    );
  }
  const after = await updateCashAdvance(id, {
    releasedAt: null,
    releasedBy: null,
    releaseBranch: { disconnect: true },
  });
  await auditLog({
    actor,
    action: "inventory.cash_advance.release_undone",
    entityType: "cash_advance",
    entityId: id,
    before: advance,
    after,
  });
}

export async function undoLoanRelease(id: string, actor: Actor): Promise<void> {
  const loan = await findLoanById(id);
  if (!loan) throw new NotFoundError("Loan", id);
  if (loan.status !== "active") {
    throw new InvalidStateTransitionError("Only a released (active) loan can be un-released.");
  }
  const applied = loan.repayments.some((r) => r.status !== "pending" || r.appliedPeriodId !== null);
  if (applied) {
    throw new InvalidStateTransitionError(
      "A repayment has already been tagged to a payroll period; this loan can no longer be un-released.",
    );
  }
  // Revert to approved: drop the repayment schedule and clear disbursement.
  await prisma.$transaction(async (tx) => {
    await tx.loanRepayment.deleteMany({ where: { loanId: id } });
    await tx.loan.update({
      where: { id },
      data: { status: "approved", disbursedAt: null, disbursedBy: null, releaseBranchId: null },
    });
  });
  await auditLog({
    actor,
    action: "inventory.loan.release_undone",
    entityType: "loan",
    entityId: id,
    before: loan,
  });
}
