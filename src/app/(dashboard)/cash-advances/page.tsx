import { redirect } from "next/navigation";
import { HandCoins } from "lucide-react";
import {
  canApproveCashAdvance,
  canViewPayroll,
  getCurrentRole,
} from "@/lib/auth/rbac";
import { getCashAdvances } from "@/server/services/cash-advance.service";
import { CashAdvancesTable } from "@/components/cash-advances/cash-advances-table";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function CashAdvancesPage() {
  const role = await getCurrentRole();
  if (!canViewPayroll(role)) redirect("/");

  const rows = await getCashAdvances();
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cash Advances</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} request{rows.length === 1 ? "" : "s"}
          {pendingCount > 0 ? ` · ${pendingCount} pending review` : ""}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No cash advance requests"
          description="Requests submitted by employees will appear here for review."
        />
      ) : (
        <CashAdvancesTable
          rows={rows}
          mode="admin"
          canApprove={canApproveCashAdvance(role)}
          canDelete={role === "super_admin"}
        />
      )}
    </div>
  );
}
