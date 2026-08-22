import { redirect } from "next/navigation";
import { PiggyBank } from "lucide-react";
import { canSuperviseSavings, getCurrentRole } from "@/lib/auth/rbac";
import { getSavingsAccounts } from "@/server/services/savings.service";
import { SavingsTable } from "@/components/savings/savings-table";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function SavingsPage() {
  const role = await getCurrentRole();
  if (!canSuperviseSavings(role)) redirect("/");

  const rows = await getSavingsAccounts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Savings</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} account{rows.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No savings accounts yet"
          description="Every employee is enrolled in savings automatically. Add an employee to create their account — contributions are withheld from each payroll run, never counted as a deduction."
        />
      ) : (
        <SavingsTable rows={rows} />
      )}
    </div>
  );
}
