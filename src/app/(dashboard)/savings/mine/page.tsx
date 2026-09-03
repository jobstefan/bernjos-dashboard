import { PiggyBank, Landmark } from "lucide-react";
import { getActor } from "@/lib/auth/rbac";
import { getEmployeeByClerkUser } from "@/server/services/employee.service";
import { getSavingsForEmployee } from "@/server/services/savings.service";
import { getMyLoans } from "@/server/services/loan.service";
import { findBranches } from "@/server/db/branches";
import { MySavings } from "@/components/savings/my-savings";
import { MyLoans } from "@/components/loans/my-loans";
import { RequestLoanDialog } from "@/components/loans/request-loan-dialog";
import { EmptyState } from "@/components/payroll/empty-state";
import { EmployeeProfileTabs } from "@/components/employees/employee-profile-tabs";

export default async function MySavingsPage() {
  const actor = await getActor();
  const employee = await getEmployeeByClerkUser(actor.clerkUserId);

  if (!employee) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">My Loans & Savings</h1>
        <EmptyState
          icon={PiggyBank}
          title="No employee record linked"
          description="Your account isn't linked to an employee profile yet. Please contact HR to view your savings."
        />
      </div>
    );
  }

  const [savings, loansView, branchRows] = await Promise.all([
    getSavingsForEmployee(employee.id),
    getMyLoans(actor.clerkUserId),
    findBranches(),
  ]);
  const branchOptions = branchRows.map((b) => ({ id: b.id, name: b.name }));

  const loansContent = (
    <MyLoans
      loans={loansView.loans}
      availableToBorrow={loansView.availableToBorrow}
      branches={branchOptions}
    />
  );

  const savingsContent = !savings ? (
    <EmptyState
      icon={PiggyBank}
      title="No savings account yet"
      description="Once an administrator sets up a savings contribution for you, your balance and activity will appear here."
    />
  ) : (
    <MySavings savings={savings} />
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Loans & Savings</h1>
          <p className="text-sm text-muted-foreground">
            {employee.firstName} {employee.lastName} · {employee.employeeCode}
          </p>
        </div>
        <RequestLoanDialog availableToBorrow={loansView.availableToBorrow} branches={branchOptions} />
      </div>

      <EmployeeProfileTabs
        tabs={[
          { value: "loans", label: "Loans", content: loansContent },
          { value: "savings", label: "Savings", content: savingsContent },
        ]}
      />
    </div>
  );
}
