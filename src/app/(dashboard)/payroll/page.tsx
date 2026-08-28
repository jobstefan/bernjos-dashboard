import { redirect } from "next/navigation";
import { CalendarClock, TrendingUp, Users, Wallet } from "lucide-react";
import { getCurrentRole, canViewPayroll, isAdmin } from "@/lib/auth/rbac";
import { getPayrollPeriods } from "@/server/services/payroll.service";
import {
  getPayrollTrend,
  getPayrollHeadline,
} from "@/server/services/analytics.service";
import { NewPeriodDialog } from "@/components/payroll/new-period-dialog";
import {
  PeriodsTable,
  type PeriodRow,
} from "@/components/payroll/periods-table";
import { EmptyState } from "@/components/payroll/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/charts/chart-card";
import { AreaTrend } from "@/components/charts/area-trend";
import { Sparkline } from "@/components/charts/sparkline";
import { SEMANTIC_COLORS } from "@/components/charts/colors";
import { formatPeso, formatDate } from "@/lib/utils/payroll";

export default async function PayrollPeriodsPage() {
  const role = await getCurrentRole();
  if (!canViewPayroll(role)) redirect("/");
  const admin = isAdmin(role);

  const periods = await getPayrollPeriods();

  const rows: PeriodRow[] = periods.map((p) => ({
    id: p.id,
    periodLabel: p.periodLabel,
    periodStart: p.periodStart.toISOString(),
    periodEnd: p.periodEnd.toISOString(),
    payDate: p.payDate.toISOString(),
    frequency: p.frequency,
    status: p.status,
    employeeCount: p._count.runItems,
    totalNet: p.runItems.reduce((sum, item) => sum + Number(item.netPay), 0),
  }));

  let trend: Awaited<ReturnType<typeof getPayrollTrend>> = [];
  let headline: Awaited<ReturnType<typeof getPayrollHeadline>> | null = null;
  try {
    [trend, headline] = await Promise.all([getPayrollTrend(6), getPayrollHeadline()]);
  } catch {
    // DB unavailable — show page without charts
  }

  const netSparkline = trend.map((p) => p.net);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            Manage payroll periods and run calculations.
          </p>
        </div>
        {admin ? <NewPeriodDialog /> : null}
      </div>

      {headline && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard
            label="Net Payroll (Latest)"
            value={formatPeso(headline.net)}
            delta={headline.netDelta ?? undefined}
            icon={<Wallet />}
            sheen
          >
            {netSparkline.length > 1 && (
              <Sparkline data={netSparkline} color={SEMANTIC_COLORS.net} />
            )}
          </KpiCard>
          <KpiCard
            label="Next Pay Date"
            value={headline.nextPayDate ? formatDate(headline.nextPayDate) : "—"}
            icon={<CalendarClock />}
            sheen={false}
          />
          <KpiCard
            label="Periods on Record"
            value={rows.length}
            icon={<TrendingUp />}
            sheen={false}
          />
        </div>
      )}

      {trend.length > 1 && (
        <ChartCard title="Payroll Trend" description="Gross vs net vs deductions">
          <AreaTrend
            data={trend}
            xKey="label"
            series={[
              { key: "gross", label: "Gross", color: SEMANTIC_COLORS.gross },
              { key: "deductions", label: "Deductions", color: SEMANTIC_COLORS.deductions },
              { key: "net", label: "Net", color: SEMANTIC_COLORS.net },
            ]}
          />
        </ChartCard>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No payroll periods yet"
          description="Create a payroll period to calculate statutory deductions and net pay for your employees."
          action={admin ? <NewPeriodDialog /> : undefined}
        />
      ) : (
        <PeriodsTable rows={rows} />
      )}
    </div>
  );
}
