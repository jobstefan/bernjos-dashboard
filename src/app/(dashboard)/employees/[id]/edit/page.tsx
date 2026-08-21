import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentRole, isAdmin } from "@/lib/auth/rbac";
import { getEmployee } from "@/server/services/employee.service";
import {
  EmployeeForm,
  type EmployeeFormValues,
} from "@/components/employees/employee-form";

/** Format a Date as `yyyy-MM-dd` for date inputs. */
function toDateInput(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const role = await getCurrentRole();
  if (!isAdmin(role)) redirect("/employees");

  const { id } = await params;
  const employee = await getEmployee(id).catch(() => null);
  if (!employee) notFound();

  const initial: EmployeeFormValues = {
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    middleName: employee.middleName ?? "",
    email: employee.email,
    position: employee.position,
    department: employee.department,
    employmentStatus: employee.employmentStatus,
    dateHired: toDateInput(employee.dateHired),
    basicSalary: String(Number(employee.basicSalary)),
    payFrequency: employee.payFrequency,
    clerkUserId: employee.clerkUserId ?? "",
    sssNumber: employee.sssNumber ?? "",
    philhealthNumber: employee.philhealthNumber ?? "",
    bankName: employee.bankName ?? "",
    bankAccountNumber: employee.bankAccountNumber ?? "",
  };

  return (
    <div className="space-y-6">
      <Link
        href={`/employees/${employee.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to profile
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Edit Employee</h1>
        <p className="text-sm text-muted-foreground">
          {employee.firstName} {employee.lastName} · {employee.employeeCode}
        </p>
      </div>
      <EmployeeForm mode="edit" initial={initial} />
    </div>
  );
}
