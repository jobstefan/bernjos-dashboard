import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil, FileText, PiggyBank, CreditCard, KeyRound } from "lucide-react";
import { getCurrentRole, canViewPayroll, isAdmin } from "@/lib/auth/rbac";
import { getEmployee } from "@/server/services/employee.service";
import { getEmployeePayslipHistory } from "@/server/services/payroll.service";
import { getCashAdvancesForEmployee } from "@/server/services/cash-advance.service";
import { getSavingsForEmployee } from "@/server/services/savings.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PayslipHistory,
  type PayslipHistoryRow,
} from "@/components/payroll/payslip-history";
import { EmptyState } from "@/components/payroll/empty-state";
import { ResetPasswordButton } from "@/components/employees/reset-password-button";
import { CashAdvancesTable } from "@/components/cash-advances/cash-advances-table";
import { SavingsLedger } from "@/components/savings/savings-ledger";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import { toneClass, type Tone } from "@/lib/utils/tone";

const EMP_STATUS_TONE: Record<string, Tone> = {
  active: "success",
  inactive: "neutral",
  resigned: "warning",
  terminated: "danger",
};

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

  const [history, advances, savings] = await Promise.all([
    getEmployeePayslipHistory(id),
    getCashAdvancesForEmployee(id),
    getSavingsForEmployee(id),
  ]);

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
    savingsContribution: p.savingsContribution,
    totalDeductions: p.totalDeductions,
    netPay: p.netPay,
    branchBreakdown: p.branchBreakdown,
  }));

  const fields: [string, string][] = [
    ["Employee code", employee.employeeCode],
    ["Full name", `${employee.firstName} ${employee.middleName ?? ""} ${employee.lastName}`.replace(/\s+/g, " ").trim()],
    ["Email", employee.user?.email ?? "—"],
    ["Contact number", employee.contactNumber ?? "—"],
    ["Address", employee.address ?? "—"],
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

  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase();
  const hasCredentials = canManage && !!employee.username;

  return (
    <div className="space-y-6">
      <Link
        href="/employees"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to employees
      </Link>

      {/* Hero header */}
      <div className="flex items-start gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {employee.position} · {employee.department}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span
              className={
                "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize " +
                toneClass(EMP_STATUS_TONE[employee.employmentStatus] ?? "neutral")
              }
            >
              {employee.employmentStatus}
            </span>
            <span className="text-xs text-muted-foreground">
              Hired {formatDate(employee.dateHired)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatPeso(Number(employee.basicSalary))}/day
            </span>
          </div>
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
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
          <TabsTrigger value="advances">Cash Advances</TabsTrigger>
          <TabsTrigger value="savings">Savings</TabsTrigger>
          {hasCredentials ? (
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
          ) : null}
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

        <TabsContent value="advances" className="mt-4">
          {advances.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              title="No cash advances"
              description="This employee has not made any cash advance requests."
            />
          ) : (
            <CashAdvancesTable
              rows={advances}
              mode="admin"
              canApprove={false}
              canDelete={false}
            />
          )}
        </TabsContent>

        <TabsContent value="savings" className="mt-4">
          {savings ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="font-mono text-lg font-semibold">
                    {formatPeso(savings.balance)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Monthly contribution
                  </p>
                  <p className="font-mono text-lg font-semibold">
                    {formatPeso(savings.contributionAmount)}
                  </p>
                </div>
              </div>
              <SavingsLedger transactions={savings.transactions} />
            </div>
          ) : (
            <EmptyState
              icon={PiggyBank}
              title="No savings account"
              description="This employee does not have a savings account set up yet."
            />
          )}
        </TabsContent>

        {hasCredentials ? (
          <TabsContent value="credentials" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="size-4" /> Login credentials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1">
                  <p>
                    Username:{" "}
                    <span className="font-mono font-medium">{employee.username}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Temporary password until first login:{" "}
                    <span className="font-mono">1234</span>. The employee sets a
                    new password on first sign-in.
                  </p>
                  <p className="text-muted-foreground">
                    Forgot their password? Reset it here — the temporary password
                    is restored and they set a new one on next sign-in.
                  </p>
                </div>
                {employee.user?.clerkId ? (
                  <ResetPasswordButton employeeId={employee.id} />
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
