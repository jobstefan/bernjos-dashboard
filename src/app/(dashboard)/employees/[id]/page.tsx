import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getCurrentRole, canViewPayroll, isAdmin } from "@/lib/auth/rbac";
import { getEmployee } from "@/server/services/employee.service";
import { getEmployeePayslipHistory } from "@/server/services/payroll.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PayslipHistory,
  type PayslipHistoryRow,
} from "@/components/payroll/payslip-history";
import { EmptyState } from "@/components/payroll/empty-state";
import { FileText } from "lucide-react";
import { formatDate, formatPeso } from "@/lib/utils/payroll";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const role = await getCurrentRole();
  if (!canViewPayroll(role)) redirect("/");
  const canManage = isAdmin(role);

  const { id } = await params;
  const employee = await getEmployee(id).catch(() => null);
  if (!employee) notFound();

  const history = await getEmployeePayslipHistory(id);
  const paid = history.filter((p) => p.period.status === "paid");
  const rows: PayslipHistoryRow[] = paid.map((p) => ({
    id: p.runItemId,
    periodLabel: p.period.label,
    payDate: p.period.payDate.toISOString(),
    status: p.period.status,
    employeeName: p.employee.fullName,
    employeeCode: p.employee.employeeCode,
    position: p.employee.position,
    department: p.employee.department,
    basicSalary: p.basicSalary,
    grossPay: p.grossPay,
    sssEmployee: p.sssEmployee,
    philhealthEmployee: p.philhealthEmployee,
    otherEarnings: p.otherEarnings,
    otherDeductions: p.otherDeductions,
    totalDeductions: p.totalDeductions,
    netPay: p.netPay,
  }));

  const fields: [string, string][] = [
    ["Employee code", employee.employeeCode],
    ["Full name", `${employee.firstName} ${employee.middleName ?? ""} ${employee.lastName}`.replace(/\s+/g, " ").trim()],
    ["Email", employee.email],
    ["Position", employee.position],
    ["Department", employee.department],
    ["Employment status", employee.employmentStatus],
    ["Date hired", formatDate(employee.dateHired)],
    ["Basic salary (daily rate)", formatPeso(Number(employee.basicSalary))],
    ["Pay frequency", employee.payFrequency === "semi_monthly" ? "Semi-monthly" : "Monthly"],
    ["SSS number", employee.sssNumber ?? "—"],
    ["PhilHealth number", employee.philhealthNumber ?? "—"],
    ["Bank name", employee.bankName ?? "—"],
    ["Bank account", employee.bankAccountNumber ?? "—"],
  ];

  return (
    <div className="space-y-6">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to employees
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {employee.position} · {employee.department}
          </p>
        </div>
        {canManage ? (
          <Button
            variant="outline"
            render={<Link href={`/employees/${employee.id}/edit`} />}
          >
            <Pencil className="size-4" /> Edit
          </Button>
        ) : null}
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="payslips">Payslip History</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employee details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="text-sm font-medium capitalize">{value}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payslips" className="mt-4">
          {rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No payslips yet"
              description="Payslips appear here once a payroll period including this employee is marked as paid."
            />
          ) : (
            <PayslipHistory rows={rows} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
