import { TriangleAlert } from "lucide-react";
import { getActor } from "@/lib/auth/rbac";
import { getEmployeeByClerkUser } from "@/server/services/employee.service";
import { getChargesForEmployee } from "@/server/services/charge.service";
import { ChargesTable } from "@/components/charges/charges-table";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function MyChargesPage() {
  const actor = await getActor();
  const employee = await getEmployeeByClerkUser(actor.clerkUserId);

  if (!employee) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">My Charges</h1>
        <EmptyState
          icon={TriangleAlert}
          title="No employee record linked"
          description="Your account isn't linked to an employee profile yet. Please contact HR."
        />
      </div>
    );
  }

  const rows = await getChargesForEmployee(employee.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Charges</h1>
        <p className="text-sm text-muted-foreground">
          {employee.firstName} {employee.lastName} · {employee.employeeCode}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={TriangleAlert}
          title="No charges"
          description="Charges applied to your account by HR will appear here and are deducted from your payroll."
        />
      ) : (
        <ChargesTable rows={rows} mode="mine" />
      )}
    </div>
  );
}
