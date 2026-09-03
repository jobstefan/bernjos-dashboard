import { redirect } from "next/navigation";
import { HandCoins, Clock, CheckCircle2, CircleDollarSign } from "lucide-react";
import {
  canApproveCashAdvance,
  canViewPayroll,
  getCurrentRole,
  isAdmin,
} from "@/lib/auth/rbac";
import { getCashAdvances } from "@/server/services/cash-advance.service";
import { getEmployees } from "@/server/services/employee.service";
import { findBranches } from "@/server/db/branches";
import { getCashAdvancePulse } from "@/server/services/analytics.service";
import { CashAdvancesTable } from "@/components/cash-advances/cash-advances-table";
import {
  AdminCreateCashAdvanceButton,
  type EmployeeOption,
  type BranchOption,
} from "@/components/cash-advances/admin-create-cash-advance-button";
import { EmptyState } from "@/components/payroll/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/charts/chart-card";
import { Donut } from "@/components/charts/donut";
import { SEMANTIC_COLORS } from "@/components/charts/colors";
import { formatPeso, getCashAdvanceStatusColor, getCashAdvanceStatusLabel } from "@/lib/utils/payroll";
import type { CashAdvanceStatus } from "@/lib/types/payroll";

export default async function CashAdvancesPage() {
  const role = await getCurrentRole();
  if (!canViewPayroll(role)) redirect("/");

  const canAdmin = isAdmin(role);

  const [rows, employeeProfiles, branchRows] = await Promise.all([
    getCashAdvances(),
    canAdmin ? getEmployees({ employmentStatus: "active" }) : Promise.resolve([]),
    canAdmin ? findBranches() : Promise.resolve([]),
  ]);

  const branchOptions: BranchOption[] = branchRows.map((b) => ({ id: b.id, name: b.name }));
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const employeeOptions: EmployeeOption[] = employeeProfiles.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
  }));

  let pulse: Awaited<ReturnType<typeof getCashAdvancePulse>> | null = null;
  try {
    pulse = await getCashAdvancePulse();
  } catch {
    // DB issue — show page without charts
  }

  const donutData = pulse?.byStatus
    .filter((s) => s.amount > 0)
    .map((s, i) => ({
      key: s.status,
      label: s.status.charAt(0).toUpperCase() + s.status.slice(1),
      value: s.amount,
      color: `var(--chart-${(i % 5) + 1})`,
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cash Advances</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} request{rows.length === 1 ? "" : "s"}
            {pendingCount > 0 ? ` · ${pendingCount} pending review` : ""}
          </p>
        </div>
        {canAdmin && employeeOptions.length > 0 && (
          <AdminCreateCashAdvanceButton employees={employeeOptions} branches={branchOptions} />
        )}
      </div>

      {pulse && (
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Pending Review"
            value={pulse.pendingCount}
            icon={<Clock />}
            sheen={false}
          />
          <KpiCard
            label="Outstanding (Approved)"
            value={formatPeso(pulse.outstanding)}
            icon={<CircleDollarSign />}
            sheen
          />
          <KpiCard
            label="Total Requests"
            value={rows.length}
            icon={<CheckCircle2 />}
            sheen={false}
          />
        </div>
      )}

      {donutData.length > 0 && pulse && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="By Status" description="Amount by request status">
            <Donut
              data={donutData}
              centerLabel="Total"
              centerValue={formatPeso(donutData.reduce((s, d) => s + d.value, 0))}
            />
          </ChartCard>

          <ChartCard title="Request Breakdown" description="Count and average amount per status">
            <ul className="divide-y">
              {pulse.byStatus
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((s) => {
                  const avg = s.count > 0 ? s.amount / s.count : 0;
                  return (
                    <li key={s.status} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                      <span
                        className={
                          "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " +
                          getCashAdvanceStatusColor(s.status as CashAdvanceStatus)
                        }
                      >
                        {getCashAdvanceStatusLabel(s.status as CashAdvanceStatus)}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-medium tabular-nums">
                          {s.count} {s.count === 1 ? "request" : "requests"}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          avg {formatPeso(avg)}
                        </p>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </ChartCard>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No cash advance requests"
          description="Requests submitted by employees will appear here for review."
        />
      ) : (
        <CashAdvancesTable
          rows={rows}
          mode="admin"
          canApprove={canApproveCashAdvance(role)}
          canDelete={role === "super_admin"}
          canRequestDeletion={role === "admin"}
          branches={branchOptions}
        />
      )}
    </div>
  );
}
