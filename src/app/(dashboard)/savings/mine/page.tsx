import { PiggyBank } from "lucide-react";
import { getActor } from "@/lib/auth/rbac";
import { getEmployeeByClerkUser } from "@/server/services/employee.service";
import { getSavingsForEmployee } from "@/server/services/savings.service";
import { MySavings } from "@/components/savings/my-savings";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function MySavingsPage() {
  const actor = await getActor();
  const employee = await getEmployeeByClerkUser(actor.clerkUserId);

  if (!employee) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">My Savings</h1>
        <EmptyState
          icon={PiggyBank}
          title="No employee record linked"
          description="Your account isn't linked to an employee profile yet. Please contact HR to view your savings."
        />
      </div>
    );
  }

  const savings = await getSavingsForEmployee(employee.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Savings</h1>
        <p className="text-sm text-muted-foreground">
          {employee.firstName} {employee.lastName} · {employee.employeeCode}
        </p>
      </div>

      {!savings ? (
        <EmptyState
          icon={PiggyBank}
          title="No savings account yet"
          description="Once an administrator sets up a savings contribution for you, your balance and activity will appear here."
        />
      ) : (
        <MySavings savings={savings} />
      )}
    </div>
  );
}
