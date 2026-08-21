import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  deleteRunItemsForPeriod,
  findOverlappingPeriod,
  findPeriodById,
  findPeriods,
  findRunItem,
  findRunItems,
  findRunItemsForEmployee,
  insertPeriod,
  insertRunItems,
  updatePeriod,
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
import {
  findPhilhealthBracket,
  findSssBracket,
} from "@/server/db/statutory";
import { auditLog } from "@/server/services/audit.service";
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
  const daysWorked = DEFAULT_WORKING_DAYS[frequency];
  const grossPay = round2(dailyRate.mul(daysWorked));
  const salaryBasis = grossPay.toNumber();

  // SSS — contribution = Monthly Salary Credit × share rate.
  const sss = await findSssBracket(salaryBasis, asOf);
  if (!sss) throw new MissingStatutoryDataError("SSS", asOf);
  const sssEmployee = round2(new Decimal(sss.monthlyCredit).mul(sss.employeeShare));
  const sssEmployer = round2(new Decimal(sss.monthlyCredit).mul(sss.employerShare));

  // PhilHealth — premium = clamp(gross, floor, ceiling) × rate; employee pays half.
  const ph = await findPhilhealthBracket(salaryBasis, asOf);
  if (!ph) throw new MissingStatutoryDataError("PhilHealth", asOf);
  const phBase = Decimal.min(Decimal.max(grossPay, ph.minSalary), ph.maxSalary);
  let phPremium = phBase.mul(ph.rate);
  phPremium = Decimal.min(
    Decimal.max(phPremium, ph.minContribution),
    ph.maxContribution,
  );
  const philhealthEmployee = round2(phPremium.div(2));
  const philhealthEmployer = round2(phPremium.div(2));

  const statutoryEmployee = sssEmployee.add(philhealthEmployee);
  const totalDeductions = round2(statutoryEmployee);
  const netPay = round2(grossPay.sub(totalDeductions));

  return {
    employeeId,
    periodId,
    frequency,
    basicSalary: toNum(dailyRate),
    daysWorked,
    grossPay: toNum(grossPay),
    sssEmployee: toNum(sssEmployee),
    sssEmployer: toNum(sssEmployer),
    philhealthEmployee: toNum(philhealthEmployee),
    philhealthEmployer: toNum(philhealthEmployer),
    totalDeductions: toNum(totalDeductions),
    netPay: toNum(netPay),
    brackets: {
      sssBracketId: sss.id,
      philhealthBracketId: ph.id,
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
  // are re-picked below and never double-counted or orphaned, and clear any
  // savings contribution ledger rows this period previously wrote.
  await resetCashAdvancesForPeriod(periodId);
  await resetSavingsContributionsForPeriod(periodId);

  const employees = await findActiveEmployeesByFrequency(period.frequency);

  const rows: Prisma.PayrollRunItemCreateManyInput[] = [];
  const appliedAdvanceIds: string[] = [];
  // Savings contributions to write to the ledger once run items are persisted.
  const savingsToApply: { accountId: string; amount: Decimal }[] = [];
  let totalGross = ZERO;
  let totalDeductions = ZERO;
  let totalNet = ZERO;

  for (const employee of employees) {
    const b = await calculateEmployeeDeductions(employee.id, periodId);

    // Fold approved, not-yet-applied cash advances into other deductions.
    const advances = await findApprovedUnappliedForEmployee(employee.id);
    let otherDeductions = ZERO;
    for (const advance of advances) {
      otherDeductions = otherDeductions.add(advance.amount);
      appliedAdvanceIds.push(advance.id);
    }
    otherDeductions = round2(otherDeductions);

    const itemTotalDeductions = round2(new Decimal(b.totalDeductions).add(otherDeductions));
    const payAfterDeductions = round2(new Decimal(b.grossPay).sub(itemTotalDeductions));

    // Savings is the employee's own money moved into their account — NOT a
    // deduction. Pull the recurring contribution (clamped so it never drives net
    // pay negative) and record it separately from `totalDeductions`.
    const account = await findSavingsAccountByEmployee(employee.id);
    let savingsContribution = ZERO;
    if (account && account.active) {
      const wanted = round2(new Decimal(account.contributionAmount));
      savingsContribution = Decimal.max(
        ZERO,
        Decimal.min(wanted, payAfterDeductions),
      );
      if (savingsContribution.gt(ZERO)) {
        savingsToApply.push({ accountId: account.id, amount: savingsContribution });
      }
    }

    const itemNetPay = round2(payAfterDeductions.sub(savingsContribution));

    rows.push({
      payrollPeriodId: periodId,
      employeeId: employee.id,
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
    });
    totalGross = totalGross.add(b.grossPay);
    totalDeductions = totalDeductions.add(itemTotalDeductions);
    totalNet = totalNet.add(itemNetPay);
  }

  // Replace any prior (non-approved) items, then insert fresh.
  await deleteRunItemsForPeriod(periodId);
  if (rows.length > 0) await insertRunItems(rows);
  if (appliedAdvanceIds.length > 0) {
    await markCashAdvancesApplied(appliedAdvanceIds, periodId);
  }
  // Write the savings contributions to each employee's ledger, tagged to this
  // period so a recalculation can reset them idempotently.
  for (const s of savingsToApply) {
    await insertSavingsTransaction({
      accountId: s.accountId,
      type: "contribution",
      amount: s.amount,
      note: `Payroll contribution — ${period.periodLabel}`,
      appliedPeriodId: periodId,
      createdBy: actor.clerkUserId,
    });
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
      id: item.employee.id,
      employeeCode: item.employee.employeeCode,
      fullName: `${item.employee.firstName} ${item.employee.lastName}`,
      position: item.employee.position,
      department: item.employee.department,
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
  };
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
