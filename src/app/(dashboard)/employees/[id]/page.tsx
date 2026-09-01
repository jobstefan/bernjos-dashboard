import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Pencil, FileText, PiggyBank, CreditCard, KeyRound } from "lucide-react";
import { getCurrentRole, canViewPayroll, isAdmin } from "@/lib/auth/rbac";
import { getEmployee } from "@/server/services/employee.service";
import { getEmployeePayslipHistory } from "@/server/services/payroll.service";
import { getCashAdvancesForEmployee } from "@/server/services/cash-advance.service";
import { getSavingsForEmployee } from "@/server/services/savings.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmployeeProfileTabs } from "@/components/employees/employee-profile-tabs";
import { SetBreadcrumbTitle } from "@/components/shell/set-breadcrumb-title";
import { CopyUsernameButton } from "@/components/employees/copy-username-button";
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
    incentiveEarnings: p.incentiveEarnings,
    overtimeMinutes: p.overtimeMinutes,
    lateDeduction: p.lateDeduction,
    advanceDeduction: p.advanceDeduction,
    otherDeductions: p.otherDeductions,
    loanDeduction: p.loanDeduction,
    savingsContribution: p.savingsContribution,
    totalDeductions: p.totalDeductions,
    netPay: p.netPay,
    branchBreakdown: p.branchBreakdown,
    daysWorked: p.daysWorked,
    absentDays: p.absentDays,
    dayOffDays: p.dayOffDays,
  }));

  const fullName = `${employee.firstName} ${employee.middleName ?? ""} ${employee.lastName}`
    .replace(/\s+/g, " ")
    .trim();

  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase();
  const hasCredentials = canManage && !!employee.username;

  return (
    <div className="space-y-6">
      <SetBreadcrumbTitle title={`${employee.firstName} ${employee.lastName}`} />

      {/* Hero header */}
      <div className="flex flex-wrap items-start gap-4">
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

      <EmployeeProfileTabs
        tabs={[
          {
            value: "profile",
            label: "Profile",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Employee details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Personal */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Personal
                    </h3>
                    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Full name</dt>
                        <dd className="text-sm font-medium">{fullName}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Employee code</dt>
                        <dd className="font-mono text-sm font-medium">{employee.employeeCode}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Email</dt>
                        <dd className="text-sm font-medium">{employee.user?.email ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Contact number</dt>
                        <dd className="text-sm font-medium">{employee.contactNumber ?? "—"}</dd>
                      </div>
                      {employee.address ? (
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-muted-foreground">Address</dt>
                          <dd className="text-sm font-medium">{employee.address}</dd>
                        </div>
                      ) : (
                        <div>
                          <dt className="text-xs text-muted-foreground">Address</dt>
                          <dd className="text-sm font-medium">—</dd>
                        </div>
                      )}
                    </dl>
                  </section>

                  <Separator />

                  {/* Employment */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Employment
                    </h3>
                    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Position</dt>
                        <dd className="text-sm font-medium">{employee.position}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Department</dt>
                        <dd className="text-sm font-medium">{employee.department}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Status</dt>
                        <dd className="mt-0.5">
                          <span
                            className={
                              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize " +
                              toneClass(EMP_STATUS_TONE[employee.employmentStatus] ?? "neutral")
                            }
                          >
                            {employee.employmentStatus}
                          </span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Date hired</dt>
                        <dd className="text-sm font-medium">{formatDate(employee.dateHired)}</dd>
                      </div>
                    </dl>
                  </section>

                  <Separator />

                  {/* Pay */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Pay
                    </h3>
                    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Daily rate</dt>
                        <dd className="font-mono text-sm font-medium">
                          {formatPeso(Number(employee.basicSalary))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Pay frequency</dt>
                        <dd className="text-sm font-medium capitalize">
                          {employee.payFrequency === "semi_monthly" ? "Semi-monthly" : "Monthly"}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  <Separator />

                  {/* Government IDs & Banking */}
                  <section className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Government IDs &amp; Banking
                    </h3>
                    <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">SSS number</dt>
                        <dd className="font-mono text-sm font-medium">{employee.sssNumber ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">PhilHealth number</dt>
                        <dd className="font-mono text-sm font-medium">{employee.philhealthNumber ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Bank name</dt>
                        <dd className="text-sm font-medium">{employee.bankName ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Account number</dt>
                        <dd className="font-mono text-sm font-medium">{employee.bankAccountNumber ?? "—"}</dd>
                      </div>
                    </dl>
                  </section>
                </CardContent>
              </Card>
            ),
          },
          {
            value: "payslips",
            label: "Payslips",
            content: rows.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No payslips yet"
                description="Payslips appear here once a payroll period including this employee is marked as paid."
              />
            ) : (
              <PayslipHistory rows={rows} />
            ),
          },
          {
            value: "advances",
            label: "Cash Advances",
            content: advances.length === 0 ? (
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
                hideSearch
              />
            ),
          },
          {
            value: "savings",
            label: "Savings",
            content: savings ? (
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-0">
                    <div className="flex divide-x divide-border">
                      <div className="flex-1 px-6 py-4">
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className="mt-1 font-mono text-xl font-semibold">
                          {formatPeso(savings.balance)}
                        </p>
                      </div>
                      <div className="flex-1 px-6 py-4">
                        <p className="text-xs text-muted-foreground">Monthly contribution</p>
                        <p className="mt-1 font-mono text-xl font-semibold">
                          {formatPeso(savings.contributionAmount)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <SavingsLedger transactions={savings.transactions} />
              </div>
            ) : (
              <EmptyState
                icon={PiggyBank}
                title="No savings account"
                description="This employee does not have a savings account set up yet."
              />
            ),
          },
          ...(hasCredentials ? [{
            value: "credentials",
            label: "Credentials",
            content: (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <KeyRound className="size-4" /> Login credentials
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-0.5">Username</p>
                      <p className="font-mono text-sm font-medium truncate">{employee.username}</p>
                    </div>
                    <CopyUsernameButton username={employee.username!} />
                  </div>

                  <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-2 text-sm text-muted-foreground">
                    <p>
                      Temporary password until first login:{" "}
                      <span className="font-mono font-medium text-foreground">1234</span>.
                      The employee sets a new password on first sign-in.
                    </p>
                    <p>
                      Forgot their password? Reset it below — the temporary password is
                      restored and they set a new one on next sign-in.
                    </p>
                  </div>

                  {employee.user?.clerkId ? (
                    <ResetPasswordButton employeeId={employee.id} />
                  ) : null}
                </CardContent>
              </Card>
            ),
          }] : []),
        ]}
      />
    </div>
  );
}

