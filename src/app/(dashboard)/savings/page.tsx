import { redirect } from "next/navigation";
import { PiggyBank, Users, TrendingUp } from "lucide-react";
import { canSuperviseSavings, getCurrentRole } from "@/lib/auth/rbac";
import { getSavingsAccounts } from "@/server/services/savings.service";
import { getSavingsStats } from "@/server/services/analytics.service";
import { SavingsTable } from "@/components/savings/savings-table";
import { EmptyState } from "@/components/payroll/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/charts/chart-card";
import { BarSeries } from "@/components/charts/bar-series";
import { SEMANTIC_COLORS } from "@/components/charts/colors";
import { formatPeso } from "@/lib/utils/payroll";

export default async function SavingsPage() {
  const role = await getCurrentRole();
  if (!canSuperviseSavings(role)) redirect("/");

  const rows = await getSavingsAccounts();

  let stats: Awaited<ReturnType<typeof getSavingsStats>> | null = null;
  try {
    stats = await getSavingsStats();
  } catch {
    // Tolerate
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Savings</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} account{rows.length === 1 ? "" : "s"}
        </p>
      </div>

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
                  series={[{ key: "balance", label: "Balance", color: SEMANTIC_COLORS.savings }]}
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
        <SavingsTable rows={rows} />
      )}
    </div>
  );
}
