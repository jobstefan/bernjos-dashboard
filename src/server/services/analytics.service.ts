import "server-only";

import { getPayrollPeriods, getPayrollRunItems, getEmployeePayslipHistory } from "@/server/services/payroll.service";
import { getEmployees } from "@/server/services/employee.service";
import { getComparison } from "@/server/services/attendance.service";
import { getCashAdvances, getCashAdvancesForEmployee } from "@/server/services/cash-advance.service";
import { getSavingsAccounts, getSavingsForEmployee } from "@/server/services/savings.service";
import { findAbsenceRequests } from "@/server/db/absence-request";
import { findLoans } from "@/server/db/loan";
import { findAdvancesForPeriod } from "@/server/db/cash-advance";
import { findChargesForPeriod } from "@/server/db/charge";
import { findRepaymentsForPeriod } from "@/server/db/loan";
import { findIncentivesForPeriod } from "@/server/db/incentive";

// ─── Admin / Manager ────────────────────────────────────────────────────────

export interface SavingsStats {
  totalBalance: number;
  memberCount: number;
  avgContribution: number;
  topBalances: { name: string; balance: number }[];
}

export async function getSavingsStats(): Promise<SavingsStats> {
  const accounts = await getSavingsAccounts();
  const active = accounts.filter((a) => !a.frozen);
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const avgContribution =
    active.length > 0
      ? active.reduce((s, a) => s + a.contributionAmount, 0) / active.length
      : 0;
  const topBalances = accounts
    .slice()
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 6)
    .map((a) => ({ name: a.employeeName, balance: a.balance }));
  return { totalBalance, memberCount: accounts.length, avgContribution, topBalances };
}

export interface PayrollTrendPoint {
  periodId: string;
  label: string;
  gross: number;
  deductions: number;
  net: number;
  sss: number;
  philhealth: number;
  other: number;
  savings: number;
}

/** Deduction mix for a specific period (not just "latest"). */
export async function getPeriodDeductionMix(periodId: string): Promise<DeductionMixSlice[]> {
  const items = await getPayrollRunItems(periodId);
  let sss = 0, philhealth = 0, other = 0, savings = 0;
  for (const item of items) {
    sss += Number(item.sssEmployee);
    philhealth += Number(item.philhealthEmployee);
    other += Number(item.otherDeductions) + Number(item.chargeDeduction);
    savings += Number(item.savingsContribution);
  }
  return [
    { key: "sss", label: "SSS", value: sss, color: "var(--chart-1)" },
    { key: "philhealth", label: "PhilHealth", value: philhealth, color: "var(--chart-2)" },
    { key: "other", label: "Other", value: other, color: "var(--chart-3)" },
    { key: "savings", label: "Savings", value: savings, color: "var(--chart-5)" },
  ].filter((s) => s.value > 0);
}

export type { BranchSummaryLine } from "@/lib/types/payroll";
import type { BranchSummaryLine, BranchEmployeeLine } from "@/lib/types/payroll";

function r2(n: number) { return Math.round(n * 100) / 100; }

/** Builds a nested map: deductMap[profileId][branchKey] = total amount. branchKey is branchId or "__null__". */
function buildFinanceMap(
  rows: { profileId?: string; amount: unknown; branchId?: string | null; approvedAmount?: unknown; loan?: { profileId: string; branchId?: string | null } }[],
  useApproved = false,
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const profileId = row.profileId ?? row.loan?.profileId;
    const branchId = (row.branchId ?? row.loan?.branchId) ?? null;
    if (!profileId) continue;
    const key = branchId ?? "__null__";
    const amount = useApproved
      ? Number((row as { approvedAmount?: unknown }).approvedAmount ?? row.amount)
      : Number(row.amount);
    if (!map.has(profileId)) map.set(profileId, new Map());
    const inner = map.get(profileId)!;
    inner.set(key, (inner.get(key) ?? 0) + amount);
  }
  return map;
}

/** Computes per-branch cash summary for a payroll period using branch-attributed finance items. */
export async function getPeriodBranchSummary(periodId: string): Promise<BranchSummaryLine[]> {
  const [items, advances, charges, repayments, incentives] = await Promise.all([
    getPayrollRunItems(periodId),
    findAdvancesForPeriod(periodId),
    findChargesForPeriod(periodId),
    findRepaymentsForPeriod(periodId),
    findIncentivesForPeriod(periodId),
  ]);

  // Finance deductions and earnings keyed by [profileId][branchId|"__null__"]
  const deductMap = buildFinanceMap(
    [
      ...advances.map((a) => ({ profileId: a.profileId, amount: a.amount, approvedAmount: a.approvedAmount, branchId: a.branchId })),
      ...charges.map((c) => ({ profileId: c.profileId, amount: c.amount, branchId: c.branchId })),
      ...repayments.map((r) => ({ loan: { profileId: r.loan.profileId, branchId: r.loan.branchId }, amount: r.amount })),
    ],
    false,
  );
  // Override advances to use approvedAmount
  const advanceMap = buildFinanceMap(
    advances.map((a) => ({ profileId: a.profileId, amount: a.amount, approvedAmount: a.approvedAmount, branchId: a.branchId })),
    true,
  );
  // Merge advanceMap into deductMap (replace advance portion with approvedAmount)
  // Rebuild deductMap cleanly: charges + repayments + advances(approvedAmount)
  const cleanDeductMap = buildFinanceMap(
    [
      ...advances.map((a) => ({ profileId: a.profileId, amount: a.approvedAmount ?? a.amount, branchId: a.branchId })),
      ...charges.map((c) => ({ profileId: c.profileId, amount: c.amount, branchId: c.branchId })),
      ...repayments.map((r) => ({ profileId: r.loan.profileId, amount: r.amount, branchId: r.loan.branchId })),
    ],
    false,
  );
  const earnMap = buildFinanceMap(
    incentives.map((i) => ({ profileId: i.profileId, amount: i.amount, branchId: i.branchId })),
    false,
  );

  const summary = new Map<string, {
    branchName: string;
    employeeIds: Set<string>;
    daysWorked: number;
    grossShare: number;
    netCash: number;
    employees: BranchEmployeeLine[];
  }>();

  function getOrInit(key: string, branchName: string) {
    if (!summary.has(key)) {
      summary.set(key, { branchName, employeeIds: new Set(), daysWorked: 0, grossShare: 0, netCash: 0, employees: [] });
    }
    return summary.get(key)!;
  }

  for (const item of items) {
    if (!item.branches.length) continue;
    const dailyRate = Number(item.basicSalary);
    const totalDays = item.branches.reduce((s, b) => s + Number(b.daysWorked), 0);
    // Statutory + savings deductions split proportionally (not branch-tied)
    const propBasis = Number(item.sssEmployee) + Number(item.philhealthEmployee)
      + Number(item.lateDeduction) + Number(item.savingsContribution);

    for (const b of item.branches) {
      const branchKey = b.branchId ?? "__null__";
      const branchName = b.branch?.name ?? "Unassigned";
      const bDays = Number(b.daysWorked);

      const grossShare = r2(bDays * dailyRate);
      const propDeductions = totalDays > 0 ? r2((bDays / totalDays) * propBasis) : 0;
      const financeDeductions = cleanDeductMap.get(item.profileId)?.get(branchKey) ?? 0;
      const financeEarnings = earnMap.get(item.profileId)?.get(branchKey) ?? 0;
      const netCash = r2(grossShare - propDeductions - financeDeductions + financeEarnings);

      const entry = getOrInit(branchKey, branchName);
      entry.employeeIds.add(item.profileId);
      entry.daysWorked += bDays;
      entry.grossShare += grossShare;
      entry.netCash += netCash;
      entry.employees.push({
        employeeId: item.profileId,
        employeeName: `${item.profile.firstName} ${item.profile.lastName}`,
        employeeCode: item.profile.employeeCode,
        daysWorked: bDays,
        grossShare,
        netCash,
      });
    }
  }

  return Array.from(summary.entries())
    .map(([key, v]) => ({
      branchId: key === "__null__" ? null : key,
      branchName: v.branchName,
      employeeCount: v.employeeIds.size,
      daysWorked: r2(v.daysWorked),
      grossShare: r2(v.grossShare),
      netCash: r2(v.netCash),
      employees: v.employees.sort((a, b) => b.netCash - a.netCash),
    }))
    .sort((a, b) => b.grossShare - a.grossShare);
}

/** Last `limit` periods that have been calculated (have run items), oldest→newest. */
export async function getPayrollTrend(limit = 6): Promise<PayrollTrendPoint[]> {
  const periods = await getPayrollPeriods();
  const withItems = periods.filter((p) => p._count.runItems > 0);
  const sliced = withItems.slice(0, limit);

  const points = await Promise.all(
    sliced.map(async (p): Promise<PayrollTrendPoint> => {
      const items = await getPayrollRunItems(p.id);
      let gross = 0, deductions = 0, net = 0, sss = 0, philhealth = 0, other = 0, savings = 0;
      for (const item of items) {
        gross += Number(item.grossPay);
        deductions += Number(item.totalDeductions);
        net += Number(item.netPay);
        sss += Number(item.sssEmployee);
        philhealth += Number(item.philhealthEmployee);
        other += Number(item.otherDeductions) + Number(item.chargeDeduction);
        savings += Number(item.savingsContribution);
      }
      return { periodId: p.id, label: p.periodLabel, gross, deductions, net, sss, philhealth, other, savings };
    }),
  );

  return points.reverse();
}

export interface PayrollHeadline {
  net: number;
  gross: number;
  netDelta: number | null;
  nextPayDate: Date | null;
  latestPeriodId: string | null;
  latestPeriodLabel: string | null;
}

export async function getPayrollHeadline(): Promise<PayrollHeadline> {
  const trend = await getPayrollTrend(2);
  const [prior, latest] = trend.length >= 2 ? [trend[0], trend[1]] : [null, trend[0] ?? null];

  const netDelta =
    latest && prior && prior.net > 0
      ? ((latest.net - prior.net) / prior.net) * 100
      : null;

  // Next pay: first non-paid period with a payDate
  const periods = await getPayrollPeriods();
  const upcoming = periods.find((p) => p.status !== "paid" && p.payDate);
  const nextPayDate = upcoming?.payDate ?? null;

  return {
    net: latest?.net ?? 0,
    gross: latest?.gross ?? 0,
    netDelta,
    nextPayDate,
    latestPeriodId: latest?.periodId ?? null,
    latestPeriodLabel: latest?.label ?? null,
  };
}

export interface DeductionMixSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export async function getDeductionMix(): Promise<DeductionMixSlice[]> {
  const trend = await getPayrollTrend(1);
  const latest = trend[0];
  if (!latest) return [];
  return [
    { key: "sss", label: "SSS", value: latest.sss, color: "var(--chart-1)" },
    { key: "philhealth", label: "PhilHealth", value: latest.philhealth, color: "var(--chart-2)" },
    { key: "other", label: "Other", value: latest.other, color: "var(--chart-3)" },
    { key: "savings", label: "Savings", value: latest.savings, color: "var(--chart-5)" },
  ].filter((s) => s.value > 0);
}

export interface WorkforceStats {
  headcount: number;
  byDepartment: { department: string; count: number }[];
  byStatus: { status: string; count: number }[];
}

export async function getWorkforceStats(): Promise<WorkforceStats> {
  const employees = await getEmployees({ employmentStatus: "active" });
  const deptMap = new Map<string, number>();
  const statusMap = new Map<string, number>();

  for (const emp of employees) {
    const dept = emp.department ?? "Unknown";
    deptMap.set(dept, (deptMap.get(dept) ?? 0) + 1);
    const status = emp.employmentStatus;
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
  }

  return {
    headcount: employees.length,
    byDepartment: Array.from(deptMap.entries())
      .map(([department, count]) => ({ department, count }))
      .sort((a, b) => b.count - a.count),
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
  };
}

export interface AttendanceTrendPoint {
  date: string;
  presentRate: number;
  lateCount: number;
  absentCount: number;
}

export interface AttendanceTrendResult {
  points: AttendanceTrendPoint[];
  topLate: { employeeName: string; lateMinutes: number }[];
}

export async function getAttendanceTrend(days = 14): Promise<AttendanceTrendResult> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  const rows = await getComparison(from, to);

  const byDate = new Map<string, { present: number; late: number; absent: number; total: number }>();
  const lateByEmployee = new Map<string, { name: string; minutes: number }>();

  for (const row of rows) {
    if (!byDate.has(row.date)) {
      byDate.set(row.date, { present: 0, late: 0, absent: 0, total: 0 });
    }
    const d = byDate.get(row.date)!;
    d.total++;
    if (row.status === "present") d.present++;
    else if (row.status === "late") { d.late++; d.present++; }
    else if (row.status === "absent") d.absent++;

    if (row.lateMinutes > 0) {
      const existing = lateByEmployee.get(row.employeeId);
      if (existing) {
        existing.minutes += row.lateMinutes;
      } else {
        lateByEmployee.set(row.employeeId, { name: row.employeeName, minutes: row.lateMinutes });
      }
    }
  }

  const points: AttendanceTrendPoint[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date: date.slice(5), // MM-DD for axis
      presentRate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
      lateCount: d.late,
      absentCount: d.absent,
    }));

  const topLate = Array.from(lateByEmployee.values())
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5)
    .map((e) => ({ employeeName: e.name, lateMinutes: e.minutes }));

  return { points, topLate };
}

export interface CashAdvancePulse {
  byStatus: { status: string; count: number; amount: number }[];
  outstanding: number;
  pendingCount: number;
}

export async function getCashAdvancePulse(): Promise<CashAdvancePulse> {
  const advances = await getCashAdvances();
  const statusMap = new Map<string, { count: number; amount: number }>();
  let outstanding = 0;
  let pendingCount = 0;

  for (const adv of advances) {
    const s = statusMap.get(adv.status) ?? { count: 0, amount: 0 };
    s.count++;
    s.amount += adv.approvedAmount ?? adv.amount;
    statusMap.set(adv.status, s);

    if (adv.status === "approved") outstanding += adv.approvedAmount ?? adv.amount;
    if (adv.status === "pending") pendingCount++;
  }

  return {
    byStatus: Array.from(statusMap.entries()).map(([status, v]) => ({ status, ...v })),
    outstanding,
    pendingCount,
  };
}

export interface PendingApprovals {
  absences: { id: string; employeeName: string; date: string }[];
  advances: { id: string; employeeName: string; amount: number }[];
  loans: { id: string; employeeName: string; amount: number }[];
  absenceCount: number;
  advanceCount: number;
  loanCount: number;
}

export async function getPendingApprovals(): Promise<PendingApprovals> {
  const [absenceRows, advanceRows, loanRows] = await Promise.all([
    findAbsenceRequests({ status: "pending" }),
    getCashAdvances({ status: "pending" }),
    findLoans({ status: "pending" }),
  ]);

  return {
    absences: absenceRows.map((r) => ({
      id: r.id,
      employeeName: `${r.profile.firstName} ${r.profile.lastName}`,
      date: r.date.toISOString().slice(0, 10),
    })),
    advances: advanceRows.map((r) => ({
      id: r.id,
      employeeName: r.employeeName,
      amount: r.amount,
    })),
    loans: loanRows.map((r) => ({
      id: r.id,
      employeeName: `${r.profile.firstName} ${r.profile.lastName}`,
      amount: Number(r.amount),
    })),
    absenceCount: absenceRows.length,
    advanceCount: advanceRows.length,
    loanCount: loanRows.length,
  };
}

// ─── Employee (self-service) ─────────────────────────────────────────────────

export interface EmployeeHeadline {
  lastNet: number;
  lastNetDelta: number | null;
  savingsBalance: number;
  lastPeriodLabel: string | null;
}

export async function getEmployeeHeadline(profileId: string): Promise<EmployeeHeadline> {
  const [payslips, savings] = await Promise.all([
    getEmployeePayslipHistory(profileId),
    getSavingsForEmployee(profileId),
  ]);

  const sorted = payslips
    .filter((p) => p.period.status === "paid")
    .sort((a, b) => new Date(b.period.payDate).getTime() - new Date(a.period.payDate).getTime());
  const latest = sorted[0];
  const prior = sorted[1];

  const lastNetDelta =
    latest && prior && prior.netPay > 0
      ? ((latest.netPay - prior.netPay) / prior.netPay) * 100
      : null;

  return {
    lastNet: latest?.netPay ?? 0,
    lastNetDelta,
    savingsBalance: savings?.balance ?? 0,
    lastPeriodLabel: latest?.period.label ?? null,
  };
}

export interface EmployeePayslipTrendPoint {
  label: string;
  net: number;
  gross: number;
}

export async function getEmployeePayslipTrend(profileId: string): Promise<EmployeePayslipTrendPoint[]> {
  const payslips = await getEmployeePayslipHistory(profileId);
  return payslips
    .filter((p) => p.period.status === "paid")
    .sort((a, b) => new Date(a.period.payDate).getTime() - new Date(b.period.payDate).getTime())
    .slice(-8)
    .map((p) => ({ label: p.period.label, net: p.netPay, gross: p.grossPay }));
}

export interface SavingsTrendPoint {
  label: string;
  balance: number;
}

export async function getEmployeeSavingsTrend(profileId: string): Promise<SavingsTrendPoint[]> {
  const savings = await getSavingsForEmployee(profileId);
  if (!savings) return [];

  let running = 0;
  return savings.transactions
    .slice()
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((t) => {
      running += t.amount;
      return {
        label: t.appliedPeriodLabel ?? new Date(t.createdAt).toLocaleDateString("en-PH", { month: "short", year: "2-digit" }),
        balance: running,
      };
    })
    .slice(-8);
}
