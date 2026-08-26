import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  deleteRunItemsForPeriod,
  findOverlappingPeriod,
  findPeriodById,
  findPeriods,
  findRunItem,
  findRunItemById,
  findRunItems,
  findRunItemsForEmployee,
  insertPeriod,
  insertRunItemsWithBranches,
  updatePeriod,
  updateRunItem,
} from "@/server/db/payroll";
import { findActiveEmployeesByFrequency, findEmployeeById } from "@/server/db/employees";
import {
  findApprovedUnappliedForEmployee,
  markCashAdvancesApplied,
  resetCashAdvancesForPeriod,
} from "@/server/db/cash-advance";
import {
  findSavingsAccountByEmployee,
  insertSavingsTransaction,
  resetSavingsContributionsForPeriod,
} from "@/server/db/savings";
import { findSssBracket } from "@/server/db/statutory";
import { auditLog } from "@/server/services/audit.service";
import { summarizeForPayroll } from "@/server/services/attendance.service";
import {
  DuplicatePeriodError,
  InvalidStateTransitionError,
  MissingStatutoryDataError,
  NotFoundError,
  PayrollAlreadyApprovedError,
} from "@/lib/errors/payroll";
import type {
  Actor,
  CreatePeriodInput,
  DeductionBreakdown,
  PayFrequency,
  Payslip,
  PayrollRunResult,
  PeriodFilters,
} from "@/lib/types/payroll";

const { Decimal } = Prisma;
type Decimal = Prisma.Decimal;

const ZERO = new Decimal(0);

/**
 * Interim working-days per pay frequency, used to turn a daily rate into a
 * period gross until the scheduling & attendance feature supplies the actual
 * days worked. Gross = daily rate × days worked.
 */
const DEFAULT_WORKING_DAYS: Record<PayFrequency, number> = {
  semi_monthly: 11,
  monthly: 22,
};

function round2(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** True when the period ends in the second half of the month (day ≥ 16). */
function isSecondCutoff(periodEnd: Date): boolean {
  return periodEnd.getUTCDate() >= 16;
}

/**
 * SSS and PhilHealth are monthly contributions taken once per month. Monthly
 * periods always deduct. For semi-monthly, SSS is taken on the second cutoff and
 * PhilHealth on the first, so each lands once per month on a different payday.
 */
function deductsSss(period: { frequency: PayFrequency; periodEnd: Date }): boolean {
  return period.frequency === "monthly" || isSecondCutoff(period.periodEnd);
}

function deductsPhilhealth(period: { frequency: PayFrequency; periodEnd: Date }): boolean {
  return period.frequency === "monthly" || !isSecondCutoff(period.periodEnd);
}

function toNum(value: Decimal | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduction calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute one employee's statutory deductions for a period. `basicSalary` is a
 * daily rate; the period gross is `daily rate × days worked` (days worked is an
 * interim default per frequency until attendance lands). SSS and PhilHealth
 * contributions are computed on that period gross. Throws
 * {@link MissingStatutoryDataError} if any bracket table is unseeded.
 */
export async function calculateEmployeeDeductions(
  employeeId: string,
  periodId: string,
): Promise<DeductionBreakdown> {
  const employee = await findEmployeeById(employeeId);
  if (!employee) throw new NotFoundError("Employee", employeeId);
  const period = await findPeriodById(periodId);
  if (!period) throw new NotFoundError("Payroll period", periodId);

  const asOf = period.periodStart;
  const frequency = period.frequency;
  const dailyRate = new Decimal(employee.basicSalary);

  // Days worked come from the schedule + attendance when the employee is
  // scheduled in the period; otherwise fall back to the per-frequency default
  // so employees/branches not yet using attendance are unaffected.
  const attendance = await summarizeForPayroll(
    employee.id,
    period.periodStart,
    period.periodEnd,
  );
  const attendanceTracked = attendance.hasSchedule;
  const daysWorked = attendanceTracked
    ? attendance.daysWorked
    : DEFAULT_WORKING_DAYS[frequency];
  const grossPay = round2(dailyRate.mul(daysWorked));
  const lateDeduction = round2(dailyRate.mul(attendance.deductionDays));

  // Days worked per branch, so net pay can be split proportionally per branch once
  // it's known (see calculatePayrollRun). Only meaningful when attendance-tracked;
  // the default-working-days fallback carries no branch data.
  const branchBreakdown = attendanceTracked
    ? attendance.byBranch.map((b) => ({
        branchId: b.branchId,
        daysWorked: b.daysWorked,
      }))
    : [];

  // Fully absent → no pay, no statutory (and skip bracket lookups so an empty
  // low bracket can't crash the run or push net pay negative).
  if (daysWorked === 0) {
    return {
      profileId: employeeId,
      periodId,
      frequency,
      basicSalary: toNum(dailyRate),
      daysWorked: 0,
      grossPay: 0,
      attendanceTracked,
      absentDays: attendance.absentDays,
      lateMinutes: 0,
      undertimeMinutes: 0,
      lateDeduction: 0,
      branchBreakdown: [],
      sssEmployee: 0,
      sssEmployer: 0,
      philhealthEmployee: 0,
      philhealthEmployer: 0,
      totalDeductions: 0,
      netPay: 0,
      brackets: { sssBracketId: "", philhealthBracketId: "" },
    };
  }

  // SSS and PhilHealth are monthly contributions, each taken once per month —
  // SSS on the second cutoff, PhilHealth on the first (monthly periods take both).
  const expectedDays = attendanceTracked
    ? attendance.scheduledDays
    : DEFAULT_WORKING_DAYS[frequency];

  let sssEmployee = ZERO;
  let sssEmployer = ZERO;
  let philhealthEmployee = ZERO;
  const philhealthEmployer = ZERO;
  let sssBracketId = "";

  if (deductsSss(period)) {
    // SSS uses the employee's declared contribution salary (often set lower to
    // reduce the contribution); if unset, fall back to the expected period gross.
    const sssBasis =
      employee.sssSalaryBasis != null
        ? new Decimal(employee.sssSalaryBasis)
        : round2(dailyRate.mul(expectedDays));

    // SSS — contribution = Monthly Salary Credit × share rate.
    const sss = await findSssBracket(sssBasis.toNumber(), asOf);
    if (!sss) throw new MissingStatutoryDataError("SSS", asOf);
    sssEmployee = round2(new Decimal(sss.monthlyCredit).mul(sss.employeeShare));
    sssEmployer = round2(new Decimal(sss.monthlyCredit).mul(sss.employerShare));
    sssBracketId = sss.id;
  }

  // PhilHealth — a fixed per-employee amount. A 0/null amount means the employee
  // doesn't contribute, so no deduction is taken.
  if (deductsPhilhealth(period) && employee.philhealthAmount != null) {
    philhealthEmployee = round2(new Decimal(employee.philhealthAmount));
  }

  const statutoryEmployee = sssEmployee.add(philhealthEmployee);
  const totalDeductions = round2(statutoryEmployee);
  const netPay = round2(grossPay.sub(totalDeductions));

  return {
    profileId: employeeId,
    periodId,
    frequency,
    basicSalary: toNum(dailyRate),
    daysWorked,
    grossPay: toNum(grossPay),
    attendanceTracked,
    absentDays: attendance.absentDays,
    lateMinutes: attendance.lateMinutes,
    undertimeMinutes: attendance.undertimeMinutes,
    lateDeduction: toNum(lateDeduction),
    branchBreakdown,
    sssEmployee: toNum(sssEmployee),
    sssEmployer: toNum(sssEmployer),
    philhealthEmployee: toNum(philhealthEmployee),
    philhealthEmployer: toNum(philhealthEmployer),
    totalDeductions: toNum(totalDeductions),
    netPay: toNum(netPay),
    brackets: {
      sssBracketId,
      philhealthBracketId: "",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Period lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export async function createPayrollPeriod(
  data: CreatePeriodInput,
  actor: Actor,
) {
  const overlap = await findOverlappingPeriod(
    data.periodStart,
    data.periodEnd,
    data.frequency,
  );
  if (overlap) {
    throw new DuplicatePeriodError(
      `A ${data.frequency.replace("_", "-")} period already overlaps ${
        overlap.periodLabel
      }.`,
    );
  }

  const period = await insertPeriod({
    periodLabel: data.periodLabel,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    payDate: data.payDate,
    frequency: data.frequency,
    notes: data.notes ?? null,
    createdBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: "payroll.period.created",
    entityType: "payroll_period",
    entityId: period.id,
    after: period,
  });
  return period;
}

export async function calculatePayrollRun(
  periodId: string,
  actor: Actor,
): Promise<PayrollRunResult> {
  const period = await findPeriodById(periodId);
  if (!period) throw new NotFoundError("Payroll period", periodId);
  if (period.status === "approved" || period.status === "paid") {
    throw new PayrollAlreadyApprovedError(periodId);
  }

  // Re-running: release any advances previously applied to this period so they
  // are re-picked below and never double-counted or orphaned. Savings
  // contributions are only written at approval, so clearing them here just
  // guards against any stray rows from an earlier flow.
  await resetCashAdvancesForPeriod(periodId);
  await resetSavingsContributionsForPeriod(periodId);

  const employees = await findActiveEmployeesByFrequency(period.frequency);

  const rows: (Prisma.PayrollRunItemCreateManyInput & {
    branches: Prisma.PayrollRunItemBranchCreateManyRunItemInput[];
  })[] = [];
  const appliedAdvanceIds: string[] = [];
  let totalGross = ZERO;
  let totalDeductions = ZERO;
  let totalNet = ZERO;

  for (const employee of employees) {
    const b = await calculateEmployeeDeductions(employee.id, periodId);

    // Late/undertime deduction (pro-rated daily rate) folds into other deductions.
    let otherDeductions = new Decimal(b.lateDeduction);

    // Fold approved, not-yet-applied cash advances into other deductions.
    const advances = await findApprovedUnappliedForEmployee(employee.id);
    for (const advance of advances) {
      otherDeductions = otherDeductions.add(advance.approvedAmount ?? advance.amount);
      appliedAdvanceIds.push(advance.id);
    }
    otherDeductions = round2(otherDeductions);

    // Summarize attendance on the run item for transparency on the payslip.
    const attendanceNote = b.attendanceTracked
      ? `Attendance: ${b.daysWorked} day(s) worked` +
        (b.absentDays ? `, ${b.absentDays} absent` : "") +
        (b.lateMinutes ? `, ${b.lateMinutes} late-min` : "") +
        (b.undertimeMinutes ? `, ${b.undertimeMinutes} undertime-min` : "")
      : null;

    const itemTotalDeductions = round2(new Decimal(b.totalDeductions).add(otherDeductions));
    const payAfterDeductions = round2(new Decimal(b.grossPay).sub(itemTotalDeductions));

    // Savings is the employee's own money moved into their account — NOT a
    // deduction. Compute the recurring contribution (clamped so it never drives
    // net pay negative) for the run item; the ledger transaction is only written
    // when the run is approved (see `approvePayrollRun`), so a provisional draft
    // never moves money into savings.
    const account = await findSavingsAccountByEmployee(employee.id);
    let savingsContribution = ZERO;
    if (account) {
      const wanted = round2(new Decimal(account.contributionAmount));
      savingsContribution = Decimal.max(
        ZERO,
        Decimal.min(wanted, payAfterDeductions),
      );
    }

    const itemNetPay = round2(payAfterDeductions.sub(savingsContribution));

    // Split net pay across branches proportionally to days worked there, so the admin
    // knows how much cash to pull from each branch's till. The last branch absorbs any
    // rounding remainder so the slices sum exactly to net.
    const totalBranchDays = b.branchBreakdown.reduce((sum, br) => sum + br.daysWorked, 0);
    let allocatedNet = ZERO;
    const branchRows = b.branchBreakdown.map((br, i) => {
      const isLast = i === b.branchBreakdown.length - 1;
      const share =
        isLast || totalBranchDays === 0
          ? round2(itemNetPay.sub(allocatedNet))
          : round2(itemNetPay.mul(br.daysWorked).div(totalBranchDays));
      allocatedNet = allocatedNet.add(share);
      return { branchId: br.branchId, daysWorked: br.daysWorked, netPay: share };
    });

    rows.push({
      payrollPeriodId: periodId,
      profileId: employee.id,
      basicSalary: employee.basicSalary,
      grossPay: b.grossPay,
      sssEmployee: b.sssEmployee,
      philhealthEmployee: b.philhealthEmployee,
      otherDeductions,
      otherEarnings: 0,
      savingsContribution,
      totalDeductions: itemTotalDeductions,
      netPay: itemNetPay,
      status: "included",
      notes: attendanceNote,
      branches: branchRows,
    });
    totalGross = totalGross.add(b.grossPay);
    totalDeductions = totalDeductions.add(itemTotalDeductions);
    totalNet = totalNet.add(itemNetPay);
  }

  // Replace any prior (non-approved) items, then insert fresh.
  await deleteRunItemsForPeriod(periodId);
  if (rows.length > 0) await insertRunItemsWithBranches(rows);
  if (appliedAdvanceIds.length > 0) {
    await markCashAdvancesApplied(appliedAdvanceIds, periodId);
  }
  const updated = await updatePeriod(periodId, { status: "calculated" });

  await auditLog({
    actor,
    action: "payroll.run.calculated",
    entityType: "payroll_period",
    entityId: periodId,
    before: period,
    after: { ...updated, itemCount: rows.length },
  });

  return {
    periodId,
    itemCount: rows.length,
    totalGross: toNum(round2(totalGross)),
    totalDeductions: toNum(round2(totalDeductions)),
    totalNet: toNum(round2(totalNet)),
  };
}

export async function submitForApproval(periodId: string, actor: Actor): Promise<void> {
  const period = await findPeriodById(periodId);
  if (!period) throw new NotFoundError("Payroll period", periodId);
  if (period.status !== "calculated") {
    throw new InvalidStateTransitionError(
      "Only a calculated period can be submitted for approval.",
    );
  }
  const after = await updatePeriod(periodId, { status: "pending_approval" });
  await auditLog({
    actor,
    action: "payroll.run.submitted",
    entityType: "payroll_period",
    entityId: periodId,
    before: period,
    after,
  });
}

export async function approvePayrollRun(periodId: string, actor: Actor): Promise<void> {
  const period = await findPeriodById(periodId);
  if (!period) throw new NotFoundError("Payroll period", periodId);
  if (period.status !== "pending_approval") {
    throw new InvalidStateTransitionError(
      "Only a period pending approval can be approved.",
    );
  }
  const after = await updatePeriod(periodId, {
    status: "approved",
    approvedBy: actor.clerkUserId,
    approvedAt: new Date(),
  });

  // Move each employee's savings contribution into their account now that the
  // run is final. Doing this at approval (not draft) means a provisional draft
  // never inflates the balance, and a withdrawal taken before approval can't
  // cancel out the contribution.
  const items = await findRunItems(periodId);
  for (const item of items) {
    if (!new Decimal(item.savingsContribution).gt(0)) continue;
    const account = await findSavingsAccountByEmployee(item.profileId);
    if (!account) continue;
    await insertSavingsTransaction({
      accountId: account.id,
      type: "contribution",
      amount: item.savingsContribution,
      note: `Payroll contribution — ${period.periodLabel}`,
      appliedPeriodId: periodId,
      createdBy: actor.clerkUserId,
    });
  }

  await auditLog({
    actor,
    action: "payroll.run.approved",
    entityType: "payroll_period",
    entityId: periodId,
    before: period,
    after,
  });
}

export async function markPayrollPaid(periodId: string, actor: Actor): Promise<void> {
  const period = await findPeriodById(periodId);
  if (!period) throw new NotFoundError("Payroll period", periodId);
  if (period.status !== "approved") {
    throw new InvalidStateTransitionError(
      "Only an approved period can be marked as paid.",
    );
  }
  const after = await updatePeriod(periodId, {
    status: "paid",
    paidBy: actor.clerkUserId,
    paidAt: new Date(),
  });
  await auditLog({
    actor,
    action: "payroll.run.paid",
    entityType: "payroll_period",
    entityId: periodId,
    before: period,
    after,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

export function getPayrollPeriods(filters?: PeriodFilters) {
  return findPeriods(filters);
}

export function getPayrollRunItems(periodId: string) {
  return findRunItems(periodId);
}

type RunItemWithRelations = Awaited<ReturnType<typeof findRunItem>>;

function toPayslip(item: NonNullable<RunItemWithRelations>): Payslip {
  return {
    runItemId: item.id,
    period: {
      id: item.period.id,
      label: item.period.periodLabel,
      periodStart: item.period.periodStart,
      periodEnd: item.period.periodEnd,
      payDate: item.period.payDate,
      frequency: item.period.frequency,
      status: item.period.status,
    },
    employee: {
      id: item.profile.id,
      employeeCode: item.profile.employeeCode,
      fullName: `${item.profile.firstName} ${item.profile.lastName}`,
      position: item.profile.position,
      department: item.profile.department,
    },
    basicSalary: toNum(item.basicSalary),
    grossPay: toNum(item.grossPay),
    sssEmployee: toNum(item.sssEmployee),
    philhealthEmployee: toNum(item.philhealthEmployee),
    otherDeductions: toNum(item.otherDeductions),
    otherEarnings: toNum(item.otherEarnings),
    savingsContribution: toNum(item.savingsContribution),
    totalDeductions: toNum(item.totalDeductions),
    netPay: toNum(item.netPay),
    status: item.status,
    remarks: item.remarks,
    branchBreakdown: item.branches.map((b) => ({
      branchName: b.branch?.name ?? "Unassigned",
      daysWorked: toNum(b.daysWorked),
      netPay: toNum(b.netPay),
    })),
  };
}

/**
 * Set (or clear) the admin remark on a single payslip. Admin-only; audited.
 * Pass a null/empty remark to clear it.
 */
export async function updatePayslipRemarks(
  runItemId: string,
  remarks: string | null,
  actor: Actor,
): Promise<void> {
  const item = await findRunItemById(runItemId);
  if (!item) throw new NotFoundError("Payslip", runItemId);
  const next = remarks && remarks.trim().length > 0 ? remarks.trim() : null;
  const after = await updateRunItem(runItemId, { remarks: next });
  await auditLog({
    actor,
    action: "payroll.payslip.remarks_updated",
    entityType: "payroll_run_item",
    entityId: runItemId,
    before: { remarks: item.remarks },
    after: { remarks: after.remarks },
  });
}

export async function getEmployeePayslip(
  employeeId: string,
  periodId: string,
): Promise<Payslip> {
  const item = await findRunItem(periodId, employeeId);
  if (!item) throw new NotFoundError("Payslip");
  return toPayslip(item);
}

export async function getEmployeePayslipHistory(
  employeeId: string,
): Promise<Payslip[]> {
  const items = await findRunItemsForEmployee(employeeId);
  return items.map(toPayslip);
}
