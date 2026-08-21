import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentRole, isAdmin } from "@/lib/auth/rbac";
import { EmployeeForm } from "@/components/employees/employee-form";

export default async function NewEmployeePage() {
  const role = await getCurrentRole();
  if (!isAdmin(role)) redirect("/employees");

  return (
    <div className="space-y-6">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to employees
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Add Employee</h1>
        <p className="text-sm text-muted-foreground">
          Create a new employee record for payroll.
        </p>
      </div>
      <EmployeeForm mode="create" />
    </div>
  );
}
