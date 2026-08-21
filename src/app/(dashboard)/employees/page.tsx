import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { getCurrentRole, canViewPayroll, isAdmin } from "@/lib/auth/rbac";
import {
  getDepartments,
  getEmployees,
} from "@/server/services/employee.service";
import { Button } from "@/components/ui/button";
import {
  EmployeesTable,
  type EmployeeRow,
} from "@/components/employees/employees-table";
import { EmptyState } from "@/components/payroll/empty-state";

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
    email: e.email,
    position: e.position,
    department: e.department,
    employmentStatus: e.employmentStatus,
    basicSalary: Number(e.basicSalary),
  }));

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
