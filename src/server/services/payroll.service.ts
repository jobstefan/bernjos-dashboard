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
  findBirBracket,
  findPagibigRate,
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
  Payslip,
  PayrollRunResult,
  PeriodFilters,
} from "@/lib/types/payroll";

const { Decimal } = Prisma;
type Decimal = Prisma.Decimal;

const ZERO = new Decimal(0);

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
 * Compute one employee's statutory deductions for a period. Monthly contributions
 * are computed first (SSS/PhilHealth/Pag-IBIG), then — for semi-monthly frequency —
 * halved before the BIR withholding lookup, per BIR practice. Throws
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
  const divisor = frequency === "semi_monthly" ? new Decimal(2) : new Decimal(1);
  const monthlySalary = new Decimal(employee.basicSalary);

  // SSS — contribution = Monthly Salary Credit × share rate.
  const sss = await findSssBracket(monthlySalary.toNumber(), asOf);
  if (!sss) throw new MissingStatutoryDataError("SSS", asOf);
  const sssEmployerMonthly = new Decimal(sss.monthlyCredit).mul(sss.employerShare);
  const sssEmployeeMonthly = new Decimal(sss.monthlyCredit).mul(sss.employeeShare);

  // PhilHealth — premium = clamp(salary, floor, ceiling) × rate; employee pays half.
  const ph = await findPhilhealthBracket(monthlySalary.toNumber(), asOf);
  if (!ph) throw new MissingStatutoryDataError("PhilHealth", asOf);
  const phBase = Decimal.min(
    Decimal.max(monthlySalary, ph.minSalary),
    ph.maxSalary,
  );
  let phPremiumMonthly = phBase.mul(ph.rate);
  phPremiumMonthly = Decimal.min(
    Decimal.max(phPremiumMonthly, ph.minContribution),
    ph.maxContribution,
  );
  const phEmployeeMonthly = phPremiumMonthly.div(2);
  const phEmployerMonthly = phPremiumMonthly.div(2);

  // Pag-IBIG — salary × employee rate, capped at max contribution.
  const pagibig = await findPagibigRate(monthlySalary.toNumber(), asOf);
  if (!pagibig) throw new MissingStatutoryDataError("Pag-IBIG", asOf);
  const pagibigEmployeeMonthly = Decimal.min(
    monthlySalary.mul(pagibig.employeeRate),
    pagibig.maxContribution,
  );
  const pagibigEmployerMonthly = Decimal.min(
    monthlySalary.mul(pagibig.employerRate),
    pagibig.maxContribution,
  );

  // Per cut-off values.
  const grossPay = round2(monthlySalary.div(divisor));
  const sssEmployee = round2(sssEmployeeMonthly.div(divisor));
  const sssEmployer = round2(sssEmployerMonthly.div(divisor));
  const philhealthEmployee = round2(phEmployeeMonthly.div(divisor));
  const philhealthEmployer = round2(phEmployerMonthly.div(divisor));
  const pagibigEmployee = round2(pagibigEmployeeMonthly.div(divisor));
  const pagibigEmployer = round2(pagibigEmployerMonthly.div(divisor));

  const statutoryEmployee = sssEmployee
    .add(philhealthEmployee)
    .add(pagibigEmployee);
  const taxableIncome = round2(Decimal.max(grossPay.sub(statutoryEmployee), ZERO));

  // BIR withholding — base tax + (taxable − excess-over) × rate.
  const bir = await findBirBracket(
    taxableIncome.toNumber(),
    employee.taxStatus,
    frequency,
    asOf,
  );
  if (!bir) throw new MissingStatutoryDataError("BIR", asOf);
  const birWithholding = round2(
    Decimal.max(
      new Decimal(bir.baseTax).add(
        taxableIncome.sub(bir.excessOver).mul(bir.rate),
      ),
      ZERO,
    ),
  );

  const totalDeductions = round2(statutoryEmployee.add(birWithholding));
  const netPay = round2(grossPay.sub(totalDeductions));

  return {
    employeeId,
    periodId,
    frequency,
    basicSalary: toNum(monthlySalary),
    grossPay: toNum(grossPay),
    sssEmployee: toNum(sssEmployee),
    sssEmployer: toNum(sssEmployer),
    philhealthEmployee: toNum(philhealthEmployee),
    philhealthEmployer: toNum(philhealthEmployer),
    pagibigEmployee: toNum(pagibigEmployee),
    pagibigEmployer: toNum(pagibigEmployer),
    taxableIncome: toNum(taxableIncome),
    birWithholding: toNum(birWithholding),
    totalDeductions: toNum(totalDeductions),
    netPay: toNum(netPay),
    brackets: {
      sssBracketId: sss.id,
      philhealthBracketId: ph.id,
      pagibigRateId: pagibig.id,
      birBracketId: bir.id,
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

  const employees = await findActiveEmployeesByFrequency(period.frequency);

  const rows: Prisma.PayrollRunItemCreateManyInput[] = [];
  let totalGross = ZERO;
  let totalDeductions = ZERO;
  let totalNet = ZERO;

  for (const employee of employees) {
    const b = await calculateEmployeeDeductions(employee.id, periodId);
    rows.push({
      payrollPeriodId: periodId,
      employeeId: employee.id,
      basicSalary: employee.basicSalary,
      grossPay: b.grossPay,
      sssEmployee: b.sssEmployee,
      philhealthEmployee: b.philhealthEmployee,
      pagibigEmployee: b.pagibigEmployee,
      birWithholding: b.birWithholding,
      otherDeductions: 0,
      otherEarnings: 0,
      totalDeductions: b.totalDeductions,
      netPay: b.netPay,
      status: "included",
    });
    totalGross = totalGross.add(b.grossPay);
    totalDeductions = totalDeductions.add(b.totalDeductions);
    totalNet = totalNet.add(b.netPay);
  }

  // Replace any prior (non-approved) items, then insert fresh.
  await deleteRunItemsForPeriod(periodId);
  if (rows.length > 0) await insertRunItems(rows);
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
      tin: item.employee.tin,
    },
    basicSalary: toNum(item.basicSalary),
    grossPay: toNum(item.grossPay),
    sssEmployee: toNum(item.sssEmployee),
    philhealthEmployee: toNum(item.philhealthEmployee),
    pagibigEmployee: toNum(item.pagibigEmployee),
    birWithholding: toNum(item.birWithholding),
    otherDeductions: toNum(item.otherDeductions),
    otherEarnings: toNum(item.otherEarnings),
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
