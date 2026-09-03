import { HandCoins } from "lucide-react";
import { getActor } from "@/lib/auth/rbac";
import { getEmployeeByClerkUser } from "@/server/services/employee.service";
import { getCashAdvancesForEmployee } from "@/server/services/cash-advance.service";
import { findBranches } from "@/server/db/branches";
import { CashAdvancesTable } from "@/components/cash-advances/cash-advances-table";
import { RequestCashAdvanceDialog } from "@/components/cash-advances/request-cash-advance-dialog";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function MyCashAdvancesPage() {
  const actor = await getActor();
  const employee = await getEmployeeByClerkUser(actor.clerkUserId);

  if (!employee) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">My Advances</h1>
        <EmptyState
          icon={HandCoins}
          title="No employee record linked"
          description="Your account isn't linked to an employee profile yet. Please contact HR to request a cash advance."
        />
      </div>
    );
  }

  const [rows, branchRows] = await Promise.all([
    getCashAdvancesForEmployee(employee.id),
    findBranches(),
  ]);
  const branchOptions = branchRows.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Advances</h1>
          <p className="text-sm text-muted-foreground">
            {employee.firstName} {employee.lastName} · {employee.employeeCode}
          </p>
        </div>
        <RequestCashAdvanceDialog branches={branchOptions} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No requests yet"
          description="Submit a cash advance request and track its status here."
          action={<RequestCashAdvanceDialog branches={branchOptions} />}
        />
      ) : (
        <CashAdvancesTable rows={rows} mode="mine" />
      )}
    </div>
  );
}
