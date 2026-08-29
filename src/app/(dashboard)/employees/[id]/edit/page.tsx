import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentRole, isAdmin } from "@/lib/auth/rbac";
import { getEmployee } from "@/server/services/employee.service";
import { getDepartmentOptions } from "@/server/services/department.service";
import {
  EmployeeForm,
  type EmployeeFormValues,
} from "@/components/employees/employee-form";
import { SetBreadcrumbTitle } from "@/components/shell/set-breadcrumb-title";

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
  const [employee, departments] = await Promise.all([
    getEmployee(id).catch(() => null),
    getDepartmentOptions(),
  ]);
  if (!employee) notFound();

  const initial: EmployeeFormValues = {
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    middleName: employee.middleName ?? "",
    email: employee.user?.email ?? "",
    position: employee.position,
    department: employee.department,
    employmentStatus: employee.employmentStatus,
    dateHired: toDateInput(employee.dateHired),
    basicSalary: String(Number(employee.basicSalary)),
    payFrequency: employee.payFrequency,
    sssNumber: employee.sssNumber ?? "",
    philhealthNumber: employee.philhealthNumber ?? "",
    sssSalaryBasis:
      employee.sssSalaryBasis != null
        ? String(Number(employee.sssSalaryBasis))
        : "",
    philhealthAmount:
      employee.philhealthAmount != null
        ? String(Number(employee.philhealthAmount))
        : "",
    contactNumber: employee.contactNumber ?? "",
    address: employee.address ?? "",
    bankName: employee.bankName ?? "",
    bankAccountNumber: employee.bankAccountNumber ?? "",
  };

  return (
    <div className="space-y-6">
      <SetBreadcrumbTitle title={`${employee.firstName} ${employee.lastName}`} />
      <Link
        href={`/employees/${employee.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to profile
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {employee.firstName} {employee.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {employee.employeeCode} · Edit employee record
        </p>
      </div>
      <EmployeeForm mode="edit" initial={initial} departments={departments} />
    </div>
  );
}
