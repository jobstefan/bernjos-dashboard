import Link from "next/link";
import { Wallet, Users, FileText, AlertTriangle } from "lucide-react";
import { getActor } from "@/lib/auth/rbac";
import { canViewPayroll } from "@/lib/auth/rbac";
import { getOrCreateUser } from "@/lib/user";
import { getEmployees } from "@/server/services/employee.service";
import { getPayrollPeriods } from "@/server/services/payroll.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { KpiCard } from "@/components/ui/kpi-card";
import { StatusBadge } from "@/components/payroll/status-badge";
import { roleLabel } from "@/components/layout/nav";
import { formatDate } from "@/lib/utils/payroll";

export default async function DashboardHome() {
  const actor = await getActor();

  // Sync the Clerk user into the DB; tolerate an unreachable database.
  // Skip when DEV_AUTH is on — there is no Clerk user to sync.
  let dbError: string | null = null;
  if (process.env.DEV_AUTH !== "true") {
    try {
      await getOrCreateUser();
    } catch (err) {
      dbError = err instanceof Error ? err.message : "Database unavailable";
    }
  }

  const canPayroll = canViewPayroll(actor.role);

  let employeeCount = 0;
  let recentPeriods: Awaited<ReturnType<typeof getPayrollPeriods>> = [];
  if (canPayroll && !dbError) {
    try {
      const [employees, periods] = await Promise.all([
        getEmployees(),
        getPayrollPeriods(),
      ]);
      employeeCount = employees.length;
      recentPeriods = periods.slice(0, 5);
    } catch (err) {
      dbError = err instanceof Error ? err.message : "Database unavailable";
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${roleLabel(actor.role)}${
          actor.email ? ` · ${actor.email}` : ""
        }`}
      />

      {dbError ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="flex-row items-center gap-2 pb-2">
            <AlertTriangle className="size-4 text-amber-600" />
            <CardTitle className="text-sm text-amber-800">
              Database not reachable
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-700">
            Run the migration and seed once the database is available:{" "}
            <code className="font-mono">pnpm db:migrate</code> then{" "}
            <code className="font-mono">pnpm dlx tsx prisma/seed.ts</code>.
            <div className="mt-1 text-xs opacity-70">{dbError}</div>
          </CardContent>
        </Card>
      ) : null}

      {canPayroll ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Active Employees"
              value={employeeCount}
              icon={<Users />}
            />
            <KpiCard
              label="Payroll Periods"
              value={recentPeriods.length}
              icon={<Wallet />}
              hint="Most recent shown below"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <QuickLink href="/payroll" icon={<Wallet className="size-5" />} label="Run Payroll" />
            <QuickLink href="/employees" icon={<Users className="size-5" />} label="Manage Employees" />
            <QuickLink href="/employees/new" icon={<Users className="size-5" />} label="Add Employee" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent payroll periods</CardTitle>
            </CardHeader>
            <CardContent>
              {recentPeriods.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No payroll periods yet.{" "}
                  <Link href="/payroll" className="text-primary hover:underline">
                    Create one
                  </Link>
                  .
                </p>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <QuickLink
            href="/payroll/payslips"
            icon={<FileText className="size-5" />}
            label="View My Payslips"
          />
        </div>
      )}
    </div>
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
