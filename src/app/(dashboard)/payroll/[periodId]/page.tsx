import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { getCurrentRole, canViewPayroll, isAdmin } from "@/lib/auth/rbac";
import { findPeriodById } from "@/server/db/payroll";
import { getPayrollRunItems } from "@/server/services/payroll.service";
import { StatusBadge } from "@/components/payroll/status-badge";
import { SummaryCard } from "@/components/payroll/summary-card";
import { PeriodActions } from "@/components/payroll/period-actions";
import {
  RunItemsTable,
  type RunItemRow,
} from "@/components/payroll/run-items-table";
import { EmptyState } from "@/components/payroll/empty-state";
import { formatDate, formatPeso } from "@/lib/utils/payroll";

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const role = await getCurrentRole();
  if (!canViewPayroll(role)) redirect("/");
  const admin = isAdmin(role);

  const { periodId } = await params;
  const period = await findPeriodById(periodId);
  if (!period) notFound();

  const items = await getPayrollRunItems(periodId);

  const rows: RunItemRow[] = items.map((item) => ({
    id: item.id,
    employeeId: item.employeeId,
    employeeName: `${item.employee.firstName} ${item.employee.lastName}`,
    employeeCode: item.employee.employeeCode,
    position: item.employee.position,
    department: item.employee.department,
    tin: item.employee.tin,
    basicSalary: Number(item.basicSalary),
    grossPay: Number(item.grossPay),
    sssEmployee: Number(item.sssEmployee),
    philhealthEmployee: Number(item.philhealthEmployee),
    pagibigEmployee: Number(item.pagibigEmployee),
    birWithholding: Number(item.birWithholding),
    otherDeductions: Number(item.otherDeductions),
    otherEarnings: Number(item.otherEarnings),
    totalDeductions: Number(item.totalDeductions),
    netPay: Number(item.netPay),
    status: item.status,
  }));

  const totals = rows.reduce(
    (acc, r) => {
      acc.gross += r.grossPay;
      acc.deductions += r.totalDeductions;
      acc.net += r.netPay;
      return acc;
    },
    { gross: 0, deductions: 0, net: 0 },
  );

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
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Total Gross" value={formatPeso(totals.gross)} />
        <SummaryCard
          title="Total Deductions"
          value={formatPeso(totals.deductions)}
          hint="SSS + PhilHealth + Pag-IBIG + BIR"
        />
        <SummaryCard title="Total Net Pay" value={formatPeso(totals.net)} />
        <SummaryCard title="Employees" value={String(rows.length)} />
      </div>

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
        <RunItemsTable rows={rows} periodLabel={period.periodLabel} />
      )}
    </div>
  );
}
