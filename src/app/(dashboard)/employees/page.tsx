import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users, UserCheck, BarChart2 } from "lucide-react";
import { getCurrentRole, canViewPayroll, isAdmin } from "@/lib/auth/rbac";
import {
  getDepartments,
  getEmployees,
} from "@/server/services/employee.service";
import { getWorkforceStats } from "@/server/services/analytics.service";
import { Button } from "@/components/ui/button";
import {
  EmployeesTable,
  type EmployeeRow,
} from "@/components/employees/employees-table";
import { EmptyState } from "@/components/payroll/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/charts/chart-card";
import { BarSeries } from "@/components/charts/bar-series";
import { SEMANTIC_COLORS } from "@/components/charts/colors";

export default async function EmployeesPage() {
  const role = await getCurrentRole();
  if (!canViewPayroll(role)) redirect("/");
  const canManage = isAdmin(role);

  const [employees, departments] = await Promise.all([
    getEmployees(),
    getDepartments(),
  ]);

  const rows: EmployeeRow[] = employees.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    fullName: `${e.firstName} ${e.lastName}`,
    email: e.user?.email ?? "—",
    position: e.position,
    department: e.department,
    employmentStatus: e.employmentStatus,
    basicSalary: Number(e.basicSalary),
  }));

  let workforce: Awaited<ReturnType<typeof getWorkforceStats>> | null = null;
  try {
    workforce = await getWorkforceStats();
  } catch {
    // Tolerate
  }

  const activeCount = rows.filter((r) => r.employmentStatus === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} employee{rows.length === 1 ? "" : "s"}
          </p>
        </div>
        {canManage ? (
          <Button render={<Link href="/employees/new" />}>
            <Plus className="size-4" /> Add Employee
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Total Employees" value={rows.length} icon={<Users />} sheen />
        <KpiCard label="Active" value={activeCount} icon={<UserCheck />} sheen={false} />
        <KpiCard
          label="Departments"
          value={departments.length}
          icon={<BarChart2 />}
          sheen={false}
        />
      </div>

      {workforce && workforce.byDepartment.length > 0 && (
        <ChartCard title="Headcount by Department" description="All employees">
          <BarSeries
            data={workforce.byDepartment}
            xKey="department"
            series={[{ key: "count", label: "Employees", color: SEMANTIC_COLORS.net }]}
            format="count"
          />
        </ChartCard>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="Add your first employee to start running payroll."
          action={
            canManage ? (
              <Button render={<Link href="/employees/new" />}>
                <Plus className="size-4" /> Add Employee
              </Button>
            ) : undefined
          }
        />
      ) : (
        <EmployeesTable
          rows={rows}
          departments={departments}
          canManage={canManage}
        />
      )}
    </div>
  );
}
