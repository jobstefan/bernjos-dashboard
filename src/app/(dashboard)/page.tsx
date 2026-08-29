import Link from "next/link";
import {
  Wallet,
  Users,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  TrendingUp,
  PiggyBank,
  Clock,
  Landmark,
} from "lucide-react";
import { getActor, canViewPayroll } from "@/lib/auth/rbac";
import { getOrCreateUser } from "@/lib/user";
import { getEmployeeByClerkUser } from "@/server/services/employee.service";
import { getPayrollPeriods } from "@/server/services/payroll.service";
import {
  getPayrollTrend,
  getPayrollHeadline,
  getDeductionMix,
  getWorkforceStats,
  getAttendanceTrend,
  getPendingApprovals,
  getEmployeeHeadline,
  getEmployeePayslipTrend,
  getEmployeeSavingsTrend,
} from "@/server/services/analytics.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { ChartCard } from "@/components/charts/chart-card";
import { AreaTrend } from "@/components/charts/area-trend";
import { BarSeries } from "@/components/charts/bar-series";
import { Donut } from "@/components/charts/donut";
import { Sparkline } from "@/components/charts/sparkline";
import { StatusBadge } from "@/components/payroll/status-badge";
import { roleLabel } from "@/components/layout/nav";
import { formatPeso, formatDate } from "@/lib/utils/payroll";
import { SEMANTIC_COLORS } from "@/components/charts/colors";

export default async function DashboardHome() {
  const actor = await getActor();

  let dbError: string | null = null;
  if (process.env.DEV_AUTH !== "true") {
    try {
      await getOrCreateUser();
    } catch (err) {
      dbError = err instanceof Error ? err.message : "Database unavailable";
    }
  }

  const canPayroll = canViewPayroll(actor.role);

  if (canPayroll && !dbError) {
    return <AdminDashboard actor={actor} />;
  } else if (!canPayroll && !dbError) {
    return <EmployeeDashboard actor={actor} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${roleLabel(actor.role)}${actor.email ? ` · ${actor.email}` : ""}`}
      />
      {dbError && <DbErrorCard error={dbError} />}
    </div>
  );
}

// ─── Admin / Manager view ────────────────────────────────────────────────────

async function AdminDashboard({ actor }: { actor: Awaited<ReturnType<typeof getActor>> }) {
  let dbError: string | null = null;
  let headline: Awaited<ReturnType<typeof getPayrollHeadline>> | null = null;
  let trend: Awaited<ReturnType<typeof getPayrollTrend>> = [];
  let deductionMix: Awaited<ReturnType<typeof getDeductionMix>> = [];
  let workforce: Awaited<ReturnType<typeof getWorkforceStats>> | null = null;
  let attendance: Awaited<ReturnType<typeof getAttendanceTrend>> | null = null;
  let approvals: Awaited<ReturnType<typeof getPendingApprovals>> | null = null;
  let recentPeriods: Awaited<ReturnType<typeof getPayrollPeriods>> = [];

  try {
    [headline, trend, deductionMix, workforce, attendance, approvals, recentPeriods] =
      await Promise.all([
        getPayrollHeadline(),
        getPayrollTrend(6),
        getDeductionMix(),
        getWorkforceStats(),
        getAttendanceTrend(14),
        getPendingApprovals(),
        getPayrollPeriods().then((p) => p.slice(0, 5)),
      ]);
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Database unavailable";
  }

  const netSparkline = trend.map((p) => p.net);
  const totalPending =
    (approvals?.absenceCount ?? 0) +
    (approvals?.advanceCount ?? 0) +
    (approvals?.loanCount ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${roleLabel(actor.role)}${actor.email ? ` · ${actor.email}` : ""}`}
      />

      {dbError && <DbErrorCard error={dbError} />}

      {/* KPI row */}
      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StaggerItem>
          <KpiCard
            label="Net Payroll (Latest)"
            value={headline ? formatPeso(headline.net) : "—"}
            delta={headline?.netDelta ?? undefined}
            icon={<Wallet />}
            sheen
          >
            {netSparkline.length > 1 && (
              <Sparkline data={netSparkline} color={SEMANTIC_COLORS.net} />
            )}
          </KpiCard>
        </StaggerItem>

        <StaggerItem>
          <KpiCard
            label="Active Employees"
            value={workforce?.headcount ?? "—"}
            icon={<Users />}
            sheen={false}
          />
        </StaggerItem>

        <StaggerItem>
          <KpiCard
            label="Next Pay Date"
            value={
              headline?.nextPayDate
                ? formatDate(headline.nextPayDate)
                : "None scheduled"
            }
            icon={<CalendarClock />}
            sheen={false}
          />
        </StaggerItem>

        <StaggerItem>
          <KpiCard
            label="Pending Approvals"
            value={totalPending}
            icon={<CheckCircle2 />}
            sheen={false}
            hint={
              totalPending > 0
                ? [
                    `${approvals?.absenceCount ?? 0} absence`,
                    `${approvals?.advanceCount ?? 0} advance`,
                    `${approvals?.loanCount ?? 0} loan`,
                  ].join(" · ")
                : undefined
            }
          />
        </StaggerItem>
      </Stagger>

      {/* Payroll trend */}
      {trend.length > 0 && (
        <ChartCard title="Payroll Trend" description="Gross vs net vs deductions per period">
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

      {/* Deduction mix + Workforce */}
      <div className="grid gap-4 lg:grid-cols-2">
        {deductionMix.length > 0 && (
          <ChartCard title="Deduction Mix" description="Latest period breakdown">
            <Donut
              data={deductionMix}
              centerLabel="Deductions"
              centerValue={formatPeso(deductionMix.reduce((s, d) => s + d.value, 0))}
            />
          </ChartCard>
        )}

        {workforce && workforce.byDepartment.length > 0 && (
          <ChartCard title="Headcount by Department" description="Active employees">
            <BarSeries
              data={workforce.byDepartment}
              xKey="department"
              series={[{ key: "count", label: "Employees", color: SEMANTIC_COLORS.net }]}
              format="count"
            />
          </ChartCard>
        )}
      </div>

      {/* Attendance trend */}
      {attendance && attendance.points.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Attendance (14 days)" description="Daily presence rate">
            <AreaTrend
              data={attendance.points}
              xKey="date"
              series={[
                { key: "presentRate", label: "Present %", color: SEMANTIC_COLORS.net },
                { key: "lateCount", label: "Late", color: SEMANTIC_COLORS.deductions },
              ]}
              format="count"
            />
          </ChartCard>

          {attendance.topLate.length > 0 && (
            <ChartCard title="Most Late (14 days)" description="Total late minutes">
              <BarSeries
                data={attendance.topLate}
                xKey="employeeName"
                layout="vertical"
                series={[{ key: "lateMinutes", label: "Late min", color: SEMANTIC_COLORS.deductions }]}
                format="minutes"
              />
            </ChartCard>
          )}
        </div>
      )}

      {/* Action feed */}
      {approvals && totalPending > 0 && (
        <Card className="shadow-warm-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pending Approvals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {approvals.absences.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Absence Requests
                </p>
                <ul className="divide-y divide-border">
                  {approvals.absences.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{a.employeeName}</span>
                      <Link href="/schedule" className="text-xs text-primary hover:underline">
                        {formatDate(a.date)} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {approvals.advances.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Cash Advances
                </p>
                <ul className="divide-y divide-border">
                  {approvals.advances.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{a.employeeName}</span>
                      <Link href="/cash-advances" className="text-xs text-primary hover:underline">
                        {formatPeso(a.amount)} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {approvals.loans.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Loan Requests
                </p>
                <ul className="divide-y divide-border">
                  {approvals.loans.map((l) => (
                    <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                      <span>{l.employeeName}</span>
                      <Link href="/savings" className="text-xs text-primary hover:underline">
                        {formatPeso(l.amount)} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent payroll periods */}
      {recentPeriods.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Payroll Periods</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {recentPeriods.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/payroll/${p.id}`}
                    className="flex items-center justify-between py-3 text-sm hover:text-primary"
                  >
                    <span>
                      {p.periodLabel}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                      </span>
                    </span>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Employee (self-service) view ────────────────────────────────────────────

async function EmployeeDashboard({ actor }: { actor: Awaited<ReturnType<typeof getActor>> }) {
  let dbError: string | null = null;
  let headline: Awaited<ReturnType<typeof getEmployeeHeadline>> | null = null;
  let payslipTrend: Awaited<ReturnType<typeof getEmployeePayslipTrend>> = [];
  let savingsTrend: Awaited<ReturnType<typeof getEmployeeSavingsTrend>> = [];

  try {
    // Resolve this Clerk user's profile
    const profile = actor.clerkUserId
      ? await getEmployeeByClerkUser(actor.clerkUserId)
      : null;

    if (profile) {
      [headline, payslipTrend, savingsTrend] = await Promise.all([
        getEmployeeHeadline(profile.id),
        getEmployeePayslipTrend(profile.id),
        getEmployeeSavingsTrend(profile.id),
      ]);
    }
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Database unavailable";
  }

  const netSparkline = payslipTrend.map((p) => p.net);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Dashboard"
        description={`Signed in as ${roleLabel(actor.role)}${actor.email ? ` · ${actor.email}` : ""}`}
      />

      {dbError && <DbErrorCard error={dbError} />}

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard
          label="Last Net Pay"
          value={headline ? formatPeso(headline.lastNet) : "—"}
          delta={headline?.lastNetDelta ?? undefined}
          icon={<Wallet />}
          hint={headline?.lastPeriodLabel ?? undefined}
          sheen
        >
          {netSparkline.length > 1 && (
            <Sparkline data={netSparkline} color={SEMANTIC_COLORS.net} />
          )}
        </KpiCard>

        <KpiCard
          label="Savings Balance"
          value={headline ? formatPeso(headline.savingsBalance) : "—"}
          icon={<PiggyBank />}
          sheen={false}
        />
      </div>

      {/* My payslip trend + savings trend */}
      <div className="grid gap-4 lg:grid-cols-2">
        {payslipTrend.length > 0 && (
          <ChartCard title="My Pay History" description="Net and gross per period">
            <AreaTrend
              data={payslipTrend}
              xKey="label"
              series={[
                { key: "gross", label: "Gross", color: SEMANTIC_COLORS.gross },
                { key: "net", label: "Net", color: SEMANTIC_COLORS.net },
              ]}
            />
          </ChartCard>
        )}

        {savingsTrend.length > 0 && (
          <ChartCard title="My Savings" description="Cumulative balance over time">
            <AreaTrend
              data={savingsTrend}
              xKey="label"
              series={[{ key: "balance", label: "Balance", color: SEMANTIC_COLORS.savings }]}
            />
          </ChartCard>
        )}
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <QuickLink href="/payroll/payslips" icon={<Wallet className="size-5" />} label="View My Payslips" />
        <QuickLink href="/cash-advances" icon={<Clock className="size-5" />} label="My Cash Advances" />
      </div>
    </div>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────

function DbErrorCard({ error }: { error: string }) {
  return (
    <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
      <CardHeader className="flex-row items-center gap-2 pb-2">
        <AlertTriangle className="size-4 text-amber-600" />
        <CardTitle className="text-sm text-amber-800 dark:text-amber-400">
          Database not reachable
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-amber-700 dark:text-amber-500">
        Run the migration and seed once the database is available:{" "}
        <code className="font-mono">pnpm db:migrate</code> then{" "}
        <code className="font-mono">pnpm dlx tsx prisma/seed.ts</code>.
        <div className="mt-1 text-xs opacity-70">{error}</div>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-sm font-medium shadow-sm transition-colors hover:border-primary hover:text-primary"
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
        {icon}
      </span>
      {label}
    </Link>
  );
}
