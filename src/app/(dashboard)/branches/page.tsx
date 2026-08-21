import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { canManageSchedule, getCurrentRole } from "@/lib/auth/rbac";
import { getBranches } from "@/server/services/branch.service";
import { BranchesTable } from "@/components/branches/branches-table";
import { NewBranchButton } from "@/components/branches/branch-dialog";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function BranchesPage() {
  const role = await getCurrentRole();
  if (!canManageSchedule(role)) redirect("/");

  const rows = await getBranches();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Branches</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} branch{rows.length === 1 ? "" : "es"}
          </p>
        </div>
        {rows.length > 0 ? <NewBranchButton /> : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No branches yet"
          description="Add your work locations so you can assign them on the daily schedule."
          action={<NewBranchButton />}
        />
      ) : (
        <BranchesTable rows={rows} canManage />
      )}
    </div>
  );
}
