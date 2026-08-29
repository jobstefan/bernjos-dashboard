import { redirect } from "next/navigation";
import { PiggyBank, Users, TrendingUp, Landmark, Banknote, Clock } from "lucide-react";
import { canSuperviseSavings, getCurrentRole } from "@/lib/auth/rbac";
import { getSavingsAccounts } from "@/server/services/savings.service";
import { getLoans, getOutstandingPrincipalByProfile } from "@/server/services/loan.service";
import { getSavingsStats } from "@/server/services/analytics.service";
import { SavingsTable } from "@/components/savings/savings-table";
import { LoansTable } from "@/components/loans/loans-table";
import { AdminCreateLoanButton } from "@/components/loans/create-loan-dialog";
import { EmptyState } from "@/components/payroll/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/charts/chart-card";
import { BarSeries } from "@/components/charts/bar-series";
import { SEMANTIC_COLORS } from "@/components/charts/colors";
import { EmployeeProfileTabs } from "@/components/employees/employee-profile-tabs";
import { formatPeso } from "@/lib/utils/payroll";

export default async function SavingsPage() {
  const role = await getCurrentRole();
  if (!canSuperviseSavings(role)) redirect("/");

  const [rows, loans, outstandingMap] = await Promise.all([
    getSavingsAccounts(),
    getLoans(),
    getOutstandingPrincipalByProfile(),
  ]);

  const availableToBorrowMap = Object.fromEntries(
    rows.map((r) => [
      r.employeeId,
      Math.max(0, r.balance - (outstandingMap[r.employeeId] ?? 0)),
    ]),
  );

  let stats: Awaited<ReturnType<typeof getSavingsStats>> | null = null;
  try {
    stats = await getSavingsStats();
  } catch {
    // Tolerate
  }

  const activeLoans = loans.filter((l) => l.status === "active");
  const pendingLoans = loans.filter((l) => l.status === "pending");
  const totalOutstanding = activeLoans.reduce((s, l) => s + l.outstandingBalance, 0);

  const loansContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="grid gap-4 sm:grid-cols-3 flex-1">
          <KpiCard
            label="Outstanding Principal"
            value={formatPeso(totalOutstanding)}
            icon={<Landmark />}
            sheen
          />
          <KpiCard
            label="Active Loans"
            value={activeLoans.length}
            icon={<Banknote />}
            sheen={false}
          />
          <KpiCard
            label="Pending Requests"
            value={pendingLoans.length}
            icon={<Clock />}
            sheen={false}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <AdminCreateLoanButton
          accounts={rows}
          availableToBorrowMap={availableToBorrowMap}
        />
      </div>

      {loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loans yet"
          description="Create a loan for an employee using the button above, or employees can request one from their savings page."
          action={
            <AdminCreateLoanButton
              accounts={rows}
              availableToBorrowMap={availableToBorrowMap}
            />
          }
        />
      ) : (
        <LoansTable rows={loans} mode="admin" />
      )}
    </div>
  );

  const savingsContent = (
    <div className="space-y-6">
      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard
              label="Total Pool"
              value={formatPeso(stats.totalBalance)}
              icon={<PiggyBank />}
              sheen
            />
            <KpiCard
              label="Members"
              value={stats.memberCount}
              icon={<Users />}
              sheen={false}
            />
            <KpiCard
              label="Avg Contribution / Period"
              value={formatPeso(stats.avgContribution)}
              icon={<TrendingUp />}
              sheen={false}
            />
          </div>

          {stats.topBalances.length > 0 && (
            <div className="lg:max-w-lg">
              <ChartCard title="Top Balances" description="Highest savings balances">
                <BarSeries
                  data={stats.topBalances}
                  xKey="name"
                  series={[
                    {
                      key: "balance",
                      label: "Balance",
                      color: SEMANTIC_COLORS.savings,
                    },
                  ]}
                />
              </ChartCard>
            </div>
          )}
        </>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No savings accounts yet"
          description="Every employee is enrolled in savings automatically. Add an employee to create their account — contributions are withheld from each payroll run, never counted as a deduction."
        />
      ) : (
        <SavingsTable rows={rows} availableToBorrowMap={availableToBorrowMap} />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Loans & Savings</h1>
        <p className="text-sm text-muted-foreground">
          {loans.length} loan{loans.length === 1 ? "" : "s"} · {rows.length} savings account
          {rows.length === 1 ? "" : "s"}
        </p>
      </div>

      <EmployeeProfileTabs
        tabs={[
          { value: "loans", label: "Loans", content: loansContent },
          { value: "savings", label: "Savings Accounts", content: savingsContent },
        ]}
      />
    </div>
  );
}
