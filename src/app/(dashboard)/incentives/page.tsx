import { redirect } from "next/navigation";
import { Gift } from "lucide-react";
import { isAdmin, getCurrentRole } from "@/lib/auth/rbac";
import { getIncentives } from "@/server/services/incentive.service";
import { getEmployees } from "@/server/services/employee.service";
import { IncentivesTable } from "@/components/incentives/incentives-table";
import {
  CreateIncentiveButton,
  type EmployeeOption,
} from "@/components/incentives/create-incentive-button";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function IncentivesPage() {
  const role = await getCurrentRole();
  if (!isAdmin(role)) redirect("/");

  const [rows, employeeProfiles] = await Promise.all([
    getIncentives(),
    getEmployees({ employmentStatus: "active" }),
  ]);

  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const employeeOptions: EmployeeOption[] = employeeProfiles.map((e) => ({
    id: e.id,
    employeeCode: e.employeeCode,
    firstName: e.firstName,
    lastName: e.lastName,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Incentives</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} incentive{rows.length === 1 ? "" : "s"}
            {pendingCount > 0
              ? ` · ${pendingCount} pending`
              : ""}
          </p>
        </div>
        {employeeOptions.length > 0 && (
          <CreateIncentiveButton employees={employeeOptions} />
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="No incentives"
          description="Incentives added here will be automatically included in the employee's next payroll run."
        />
      ) : (
        <IncentivesTable rows={rows} />
      )}
    </div>
  );
}
