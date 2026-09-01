import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { isAdmin, getCurrentRole } from "@/lib/auth/rbac";
import { getCharges } from "@/server/services/charge.service";
import { getEmployees } from "@/server/services/employee.service";
import { ChargesTable } from "@/components/charges/charges-table";
import {
  CreateChargeButton,
  type EmployeeOption,
} from "@/components/charges/create-charge-button";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function ChargesPage() {
  const role = await getCurrentRole();
  if (!isAdmin(role)) redirect("/");

  const [rows, employeeProfiles] = await Promise.all([
    getCharges(),
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
          <h1 className="text-2xl font-bold tracking-tight">Charges</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} charge{rows.length === 1 ? "" : "s"}
            {pendingCount > 0
              ? ` · ${pendingCount} pending deduction`
              : ""}
          </p>
        </div>
        {employeeOptions.length > 0 && (
          <CreateChargeButton employees={employeeOptions} />
        )}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={TriangleAlert}
          title="No charges"
          description="Charges added here will be automatically deducted from the employee's next payroll run."
        />
      ) : (
        <ChargesTable
          rows={rows}
          canDelete={role === "super_admin" || role === "admin"}
        />
      )}
    </div>
  );
}
