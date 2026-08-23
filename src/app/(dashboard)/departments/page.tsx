import { redirect } from "next/navigation";
import { Network } from "lucide-react";
import { getCurrentRole, isAdmin } from "@/lib/auth/rbac";
import { getDepartments } from "@/server/services/department.service";
import { DepartmentsManager } from "@/components/departments/departments-manager";
import { NewDepartmentButton } from "@/components/departments/department-dialog";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function DepartmentsPage() {
  const role = await getCurrentRole();
  if (!isAdmin(role)) redirect("/");

  const departments = await getDepartments();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          <p className="text-sm text-muted-foreground">
            {departments.length} department
            {departments.length === 1 ? "" : "s"}
          </p>
        </div>
        {departments.length > 0 ? <NewDepartmentButton /> : null}
      </div>

      {departments.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No departments yet"
          description="Add departments and the positions under them so you can pick them on the employee form."
          action={<NewDepartmentButton />}
        />
      ) : (
        <DepartmentsManager departments={departments} />
      )}
    </div>
  );
}
