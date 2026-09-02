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
  softDeletePeriod,
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
  findPendingChargesForEmployee,
  markChargesApplied,
  resetChargesForPeriod,
} from "@/server/db/charge";
import {
  findPendingIncentivesForEmployee,
  markIncentivesApplied,
  resetIncentivesForPeriod,
} from "@/server/db/incentive";
import {
  finalizeRepaymentsForPeriod,
  findFullyRepaidLoansInPeriod,
  findPendingRepaymentsForEmployee,
  markRepaymentsTagged,
  resetRepaymentsForPeriod,
  updateLoan,
} from "@/server/db/loan";
import {
  findSavingsAccountByEmployee,
  insertSavingsTransaction,
  resetSavingsContributionsForPeriod,
} from "@/server/db/savings";
import { findSssBracket } from "@/server/db/statutory";
import { auditLog } from "@/server/services/audit.service";
import { summarizeForPayroll } from "@/server/services/attendance.service";
import { findPositionByNamesAndDept } from "@/server/db/positions";
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
import type { UpdatePeriodDatesSchema } from "@/lib/validations/payroll";

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
 * interim default per frequency until attendance lands). SSS uses the employee's
 * declared `sssSalaryBasis`; a null value means no SSS deduction is taken.
 * PhilHealth uses `philhealthAmount`; null means no deduction. Throws
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

  // Look up the position's standard shift to get a fixed per-minute rate.
  const positionRecord =
    employee.position && employee.department
      ? await findPositionByNamesAndDept(employee.position, employee.department)
      : null;
  const standardShiftMinutes = (positionRecord?.shiftHours ?? 8) * 60;

  // Days worked come from the schedule + attendance when the employee is
  // scheduled in the period; otherwise fall back to the per-frequency default
  // so employees/branches not yet using attendance are unaffected.
  const attendance = await summarizeForPayroll(
    employee.id,
    period.periodStart,
    period.periodEnd,
    standardShiftMinutes,
  );
  const attendanceTracked = attendance.hasSchedule;
  const daysWorked = attendanceTracked
    ? attendance.daysWorked
    : DEFAULT_WORKING_DAYS[frequency];
  const grossPay = round2(dailyRate.mul(daysWorked));
  const lateDeduction = round2(dailyRate.mul(attendance.deductionDays));
  const overtimeEarnings =
    attendanceTracked
      ? round2(dailyRate.mul(attendance.overtimeMinutes).div(standardShiftMinutes))
      : ZERO;

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
      overtimeMinutes: 0,
      overtimeEarnings: 0,
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

  // SSS — a null sssSalaryBasis means no SSS deduction (same logic as PhilHealth).
  if (deductsSss(period) && employee.sssSalaryBasis != null) {
    const sssBasis = new Decimal(employee.sssSalaryBasis);
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
    overtimeMinutes: attendanceTracked ? attendance.overtimeMinutes : 0,
    overtimeEarnings: toNum(overtimeEarnings),
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

  // Re-running: release any advances and repayments previously tagged to this
  // period so they are re-picked below and never double-counted or orphaned.
  // Savings contributions are only written at approval, so clearing them here
  // just guards against any stray rows from an earlier flow.
  await resetCashAdvancesForPeriod(periodId);
  await resetRepaymentsForPeriod(periodId);
  await resetSavingsContributionsForPeriod(periodId);
  await resetChargesForPeriod(periodId);
  await resetIncentivesForPeriod(periodId);

  const employees = await findActiveEmployeesByFrequency(period.frequency);

  const rows: (Prisma.PayrollRunItemCreateManyInput & {
    branches: Prisma.PayrollRunItemBranchCreateManyRunItemInput[];
  })[] = [];
  const appliedAdvanceIds: string[] = [];
  const taggedRepaymentIds: string[] = [];
  const appliedChargeIds: string[] = [];
  const appliedIncentiveIds: string[] = [];
  let totalGross = ZERO;
  let totalDeductions = ZERO;
  let totalNet = ZERO;

  for (const employee of employees) {
    const b = await calculateEmployeeDeductions(employee.id, periodId);

    // Late/undertime deduction (pro-rated daily rate).
    const lateDeduction = round2(new Decimal(b.lateDeduction));

    // Fold approved, not-yet-applied cash advances into a dedicated advance line.
    const advances = await findApprovedUnappliedForEmployee(employee.id);
    let advanceDeduction = ZERO;
    for (const advance of advances) {
      advanceDeduction = advanceDeduction.add(advance.approvedAmount ?? advance.amount);
      appliedAdvanceIds.push(advance.id);
    }
    advanceDeduction = round2(advanceDeduction);

    const otherDeductions = round2(lateDeduction.add(advanceDeduction));

    // Fold pending loan repayment installments into a dedicated loan deduction line.
    const pendingRepayments = await findPendingRepaymentsForEmployee(employee.id);
    let loanDeduction = ZERO;
    for (const rep of pendingRepayments) {
      loanDeduction = loanDeduction.add(rep.amount);
      taggedRepaymentIds.push(rep.id);
    }
    loanDeduction = round2(loanDeduction);

    // Fold pending charges (admin-imposed deductions) into a dedicated charge line.
    const pendingCharges = await findPendingChargesForEmployee(employee.id);
    let chargeDeduction = ZERO;
    for (const charge of pendingCharges) {
      chargeDeduction = chargeDeduction.add(charge.amount);
      appliedChargeIds.push(charge.id);
    }
    chargeDeduction = round2(chargeDeduction);

    // Fold pending incentives (admin-granted extra earnings) into a dedicated line.
    const pendingIncentives = await findPendingIncentivesForEmployee(employee.id);
    let incentiveEarnings = ZERO;
    for (const inc of pendingIncentives) {
      incentiveEarnings = incentiveEarnings.add(inc.amount);
      appliedIncentiveIds.push(inc.id);
    }
    incentiveEarnings = round2(incentiveEarnings);

    // Summarize attendance on the run item for transparency on the payslip.
    const attendanceNote = b.attendanceTracked
      ? `Attendance: ${b.daysWorked} day(s) worked` +
        (b.absentDays ? `, ${b.absentDays} absent` : "") +
        (b.lateMinutes ? `, ${b.lateMinutes} late-min` : "") +
        (b.undertimeMinutes ? `, ${b.undertimeMinutes} undertime-min` : "") +
        (b.overtimeMinutes ? `, ${b.overtimeMinutes} overtime-min` : "")
      : null;

    const overtimeEarnings = round2(new Decimal(b.overtimeEarnings));
    const itemTotalDeductions = round2(new Decimal(b.totalDeductions).add(otherDeductions).add(loanDeduction).add(chargeDeduction));
    const payAfterDeductions = round2(new Decimal(b.grossPay).add(overtimeEarnings).add(incentiveEarnings).sub(itemTotalDeductions));

    // Savings is the employee's own money moved into their account — NOT a
    // deduction. Compute the recurring contribution (clamped so it never drives
    // net pay negative) for the run item; the ledger transaction is only written
    // when the run is approved (see `approvePayrollRun`), so a provisional draft
    // never moves money into savings.
    const account = await findSavingsAccountByEmployee(employee.id);
    let savingsContribution = ZERO;
    if (account && !account.frozen) {
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
      lateDeduction,
      advanceDeduction,
      otherDeductions,
      loanDeduction,
      chargeDeduction,
      otherEarnings: overtimeEarnings,
      incentiveEarnings,
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
  if (taggedRepaymentIds.length > 0) {
    await markRepaymentsTagged(taggedRepaymentIds, periodId);
  }
  if (appliedChargeIds.length > 0) {
    await markChargesApplied(appliedChargeIds, periodId);
  }
  if (appliedIncentiveIds.length > 0) {
    await markIncentivesApplied(appliedIncentiveIds, periodId);
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

  // Finalize loan repayments for this period and auto-complete fully-repaid loans.
  await finalizeRepaymentsForPeriod(periodId);
  const completedLoans = await findFullyRepaidLoansInPeriod(periodId);
  for (const loan of completedLoans) {
    await updateLoan(loan.id, { status: "completed" });
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

export async function updatePayrollPeriodDates(
  periodId: string,
  data: UpdatePeriodDatesSchema,
  actor: Actor,
): Promise<void> {
  const period = await findPeriodById(periodId);
  if (!period) throw new NotFoundError("Payroll period", periodId);
  if (period.status !== "draft") {
    throw new InvalidStateTransitionError(
      "Date edits are only allowed on draft periods.",
    );
  }
  const overlap = await findOverlappingPeriod(
    data.periodStart,
    data.periodEnd,
    period.frequency,
    periodId,
  );
  if (overlap) {
    throw new DuplicatePeriodError(
      `A ${period.frequency.replace("_", "-")} period already overlaps ${overlap.periodLabel}.`,
    );
  }
  const after = await updatePeriod(periodId, {
    periodLabel: data.periodLabel,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    payDate: data.payDate,
    notes: data.notes ?? null,
  });
  await auditLog({
    actor,
    action: "payroll.period.dates_updated",
    entityType: "payroll_period",
    entityId: periodId,
    before: period,
    after,
  });
}

export async function deletePayrollPeriod(
  periodId: string,
  actor: Actor,
): Promise<void> {
  const period = await findPeriodById(periodId);
  if (!period) throw new NotFoundError("Payroll period", periodId);
  if (period.status === "approved" || period.status === "paid") {
    throw new InvalidStateTransitionError(
      "Approved or paid periods cannot be deleted.",
    );
  }
  await softDeletePeriod(periodId);
  await auditLog({
    actor,
    action: "payroll.period.deleted",
    entityType: "payroll_period",
    entityId: periodId,
    before: period,
    after: null,
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

function parseOvertimeMinutes(notes: string | null): number {
  if (!notes) return 0;
  const match = notes.match(/(\d+) overtime-min/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseLateMinutes(notes: string | null): number {
  const match = notes?.match(/(\d+) late-min/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseUndertimeMinutes(notes: string | null): number {
  const match = notes?.match(/(\d+) undertime-min/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseDaysWorked(notes: string | null): number {
  const match = notes?.match(/Attendance: (\d+) day/) ?? null;
  return match ? parseInt(match[1], 10) : 0;
}

function parseAbsentDays(notes: string | null): number {
  const match = notes?.match(/(\d+) absent/) ?? null;
  return match ? parseInt(match[1], 10) : 0;
}

function toPayslip(item: NonNullable<RunItemWithRelations>): Payslip {
  const daysWorked = parseDaysWorked(item.notes);
  const absentDays = parseAbsentDays(item.notes);
  const scheduledDays = daysWorked + absentDays;
  const calendarDays = scheduledDays > 0
    ? Math.round(
        (item.period.periodEnd.getTime() - item.period.periodStart.getTime()) / 86400000,
      ) + 1
    : 0;
  const dayOffDays = scheduledDays > 0 ? Math.max(0, calendarDays - scheduledDays) : 0;

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
    lateDeduction: toNum(item.lateDeduction),
    advanceDeduction: toNum(item.advanceDeduction),
    otherDeductions: toNum(item.otherDeductions),
    loanDeduction: toNum(item.loanDeduction),
    chargeDeduction: toNum(item.chargeDeduction),
    otherEarnings: toNum(item.otherEarnings),
    incentiveEarnings: toNum(item.incentiveEarnings),
    overtimeMinutes: parseOvertimeMinutes(item.notes),
    lateMinutes: parseLateMinutes(item.notes),
    undertimeMinutes: parseUndertimeMinutes(item.notes),
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
    daysWorked: scheduledDays > 0 ? daysWorked : undefined,
    absentDays: scheduledDays > 0 ? absentDays : undefined,
    dayOffDays: scheduledDays > 0 ? dayOffDays : undefined,
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

export async function toggleRunItemStatus(
  runItemId: string,
  actor: Actor,
): Promise<{ status: string }> {
  const item = await findRunItemById(runItemId);
  if (!item) throw new NotFoundError("Payslip", runItemId);
  if (item.period.status === "approved" || item.period.status === "paid") {
    throw new InvalidStateTransitionError("Cannot modify an approved or paid period.");
  }
  const next = item.status === "included" ? "excluded" : "included";
  const after = await updateRunItem(runItemId, { status: next });
  await auditLog({
    actor,
    action: "payroll.payslip.status_toggled",
    entityType: "payroll_run_item",
    entityId: runItemId,
    before: { status: item.status },
    after: { status: next },
  });
  return { status: after.status };
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
