import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { getCurrentRole, canViewPayroll, isAdmin } from "@/lib/auth/rbac";
import { getPayrollPeriods } from "@/server/services/payroll.service";
import { NewPeriodDialog } from "@/components/payroll/new-period-dialog";
import {
  PeriodsTable,
  type PeriodRow,
} from "@/components/payroll/periods-table";
import { EmptyState } from "@/components/payroll/empty-state";

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
