import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { getCurrentRole, canViewPayroll, isAdmin, isSuperAdmin } from "@/lib/auth/rbac";
import { findPeriodById } from "@/server/db/payroll";
import { getPayrollRunItems } from "@/server/services/payroll.service";
import { getPeriodDeductionMix } from "@/server/services/analytics.service";
import { StatusBadge } from "@/components/payroll/status-badge";
import { KpiCard } from "@/components/ui/kpi-card";
import { PeriodActions } from "@/components/payroll/period-actions";
import { ChartCard } from "@/components/charts/chart-card";
import { Donut } from "@/components/charts/donut";
import { BarSeries } from "@/components/charts/bar-series";
import { SEMANTIC_COLORS } from "@/components/charts/colors";
import {
  RunItemsTable,
  type RunItemRow,
} from "@/components/payroll/run-items-table";
import { EmptyState } from "@/components/payroll/empty-state";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import { Wallet, PiggyBank, TrendingDown } from "lucide-react";

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const role = await getCurrentRole();
  if (!canViewPayroll(role)) redirect("/");
  const admin = isAdmin(role);
  const superAdmin = isSuperAdmin(role);

  const { periodId } = await params;
  const period = await findPeriodById(periodId);
  if (!period) notFound();

  const items = await getPayrollRunItems(periodId);

  const calendarDays =
    Math.round((period.periodEnd.getTime() - period.periodStart.getTime()) / 86400000) + 1;

  const rows: RunItemRow[] = items.map((item) => {
    const dwMatch = item.notes?.match(/Attendance: (\d+) day/)?.[1];
    const abMatch = item.notes?.match(/(\d+) absent/)?.[1];
    const dw = dwMatch ? parseInt(dwMatch, 10) : undefined;
    const ab = abMatch ? parseInt(abMatch, 10) : undefined;
    const scheduled = dw != null ? (dw + (ab ?? 0)) : undefined;
    return {
      id: item.id,
      employeeId: item.profileId,
      employeeName: `${item.profile.firstName} ${item.profile.lastName}`,
      employeeCode: item.profile.employeeCode,
      position: item.profile.position,
      department: item.profile.department,
      basicSalary: Number(item.basicSalary),
      grossPay: Number(item.grossPay),
      sssEmployee: Number(item.sssEmployee),
      philhealthEmployee: Number(item.philhealthEmployee),
      lateDeduction: Number(item.lateDeduction),
      advanceDeduction: Number(item.advanceDeduction),
      otherDeductions: Number(item.otherDeductions),
      loanDeduction: Number(item.loanDeduction),
      chargeDeduction: Number(item.chargeDeduction),
      otherEarnings: Number(item.otherEarnings),
      incentiveEarnings: Number(item.incentiveEarnings),
      savingsContribution: Number(item.savingsContribution),
      totalDeductions: Number(item.totalDeductions),
      netPay: Number(item.netPay),
      status: item.status,
      remarks: item.remarks,
      branchBreakdown: item.branches.map((b) => ({
        branchName: b.branch?.name ?? "Unassigned",
        daysWorked: Number(b.daysWorked),
        netPay: Number(b.netPay),
      })),
      daysWorked: dw,
      absentDays: ab,
      dayOffDays: scheduled != null ? Math.max(0, calendarDays - scheduled) : undefined,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.gross += r.grossPay;
      acc.deductions += r.totalDeductions;
      acc.net += r.netPay;
      return acc;
    },
    { gross: 0, deductions: 0, net: 0 },
  );

  let deductionMix: Awaited<ReturnType<typeof getPeriodDeductionMix>> = [];
  try {
    deductionMix = await getPeriodDeductionMix(periodId);
  } catch {
    // Tolerate analytics failures
  }

  const otData = rows
    .filter((r) => r.otherEarnings > 0)
    .sort((a, b) => b.otherEarnings - a.otherEarnings)
    .slice(0, 6)
    .map((r) => ({ name: r.employeeName, ot: r.otherEarnings }));

  return (
    <div className="space-y-6">
      <Link
        href="/payroll"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to periods
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {period.periodLabel}
            </h1>
            <StatusBadge status={period.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDate(period.periodStart)} – {formatDate(period.periodEnd)} ·
            Pay date {formatDate(period.payDate)} ·{" "}
            {period.frequency === "semi_monthly" ? "Semi-monthly" : "Monthly"}
          </p>
          {period.status === "paid" && period.paidAt ? (
            <p className="text-xs text-emerald-700">
              Paid on {formatDate(period.paidAt)}
            </p>
          ) : null}
        </div>
        <PeriodActions
          periodId={period.id}
          status={period.status}
          isAdmin={admin}
          isSuperAdmin={superAdmin}
          period={{
            periodLabel: period.periodLabel,
            periodStart: period.periodStart.toISOString(),
            periodEnd: period.periodEnd.toISOString(),
            payDate: period.payDate.toISOString(),
            notes: period.notes,
            frequency: period.frequency,
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Gross" value={formatPeso(totals.gross)} icon={<Wallet />} sheen />
        <KpiCard label="Total Deductions" value={formatPeso(totals.deductions)} icon={<TrendingDown />} sheen={false} hint="SSS + PhilHealth + other" />
        <KpiCard label="Total Net Pay" value={formatPeso(totals.net)} icon={<Wallet />} sheen={false} />
        <KpiCard label="Employees" value={rows.length} icon={<Users />} sheen={false} />
      </div>

      {(deductionMix.length > 0 || otData.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {deductionMix.length > 0 && (
            <ChartCard title="Deduction Mix" description="Breakdown for this period">
              <Donut
                data={deductionMix}
                centerLabel="Deductions"
                centerValue={formatPeso(totals.deductions)}
              />
            </ChartCard>
          )}
          {otData.length > 0 && (
            <ChartCard title="Overtime Earnings" description="Top earners this period">
              <BarSeries
                data={otData}
                series={[{ key: "ot", label: "OT Earnings", color: SEMANTIC_COLORS.gold }]}
                xKey="name"
                layout="vertical"
                format="peso"
              />
            </ChartCard>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No run items yet"
          description={
            period.status === "draft"
              ? "Calculate the run to generate payslips for all active employees matching this period's frequency."
              : "No active employees matched this period's pay frequency."
          }
        />
      ) : (
        <RunItemsTable
          rows={rows}
          periodLabel={period.periodLabel}
          canEditRemarks={admin}
        />
      )}
    </div>
  );
}
