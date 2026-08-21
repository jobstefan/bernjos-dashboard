import { redirect } from "next/navigation";
import { PiggyBank } from "lucide-react";
import { canSuperviseSavings, getCurrentRole } from "@/lib/auth/rbac";
import { getSavingsAccounts } from "@/server/services/savings.service";
import { getEmployees } from "@/server/services/employee.service";
import { SavingsTable } from "@/components/savings/savings-table";
import {
  NewSavingsButton,
  type EmployeeOption,
} from "@/components/savings/savings-account-dialog";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function SavingsPage() {
  const role = await getCurrentRole();
  if (!canSuperviseSavings(role)) redirect("/");

  const [rows, employees] = await Promise.all([
    getSavingsAccounts(),
    getEmployees({ employmentStatus: "active" }),
  ]);

  // Only offer employees who don't already have a savings account for setup.
  const enrolled = new Set(rows.map((r) => r.employeeId));
  const options: EmployeeOption[] = employees
    .filter((e) => !enrolled.has(e.id))
    .map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      code: e.employeeCode,
    }));

  const activeCount = rows.filter((r) => r.active).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Savings</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} account{rows.length === 1 ? "" : "s"}
            {rows.length > 0 ? ` · ${activeCount} active` : ""}
          </p>
        </div>
        {rows.length > 0 ? <NewSavingsButton employees={options} /> : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No savings accounts yet"
          description="Set up a recurring contribution for an employee. It's withheld from each payroll run into their savings — never counted as a deduction."
          action={<NewSavingsButton employees={options} />}
        />
      ) : (
        <SavingsTable rows={rows} employees={options} />
      )}
    </div>
  );
}
