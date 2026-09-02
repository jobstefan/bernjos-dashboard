import { FileText } from "lucide-react";
import { getActor } from "@/lib/auth/rbac";
import { getEmployeeByClerkUser } from "@/server/services/employee.service";
import { getEmployeePayslipHistory } from "@/server/services/payroll.service";
import { EmptyState } from "@/components/payroll/empty-state";
import {
  PayslipHistory,
  type PayslipHistoryRow,
} from "@/components/payroll/payslip-history";

export default async function MyPayslipsPage() {
  const actor = await getActor();
  const employee = await getEmployeeByClerkUser(actor.clerkUserId);

  if (!employee) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">My Payslips</h1>
        <EmptyState
          icon={FileText}
          title="No employee record linked"
          description="Your account isn't linked to an employee profile yet. Please contact HR to connect your payroll records."
        />
      </div>
    );
  }

  const history = await getEmployeePayslipHistory(employee.id);
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
    lateMinutes: p.lateMinutes,
    undertimeMinutes: p.undertimeMinutes,
    advanceDeduction: p.advanceDeduction,
    otherDeductions: p.otherDeductions,
    loanDeduction: p.loanDeduction,
    chargeDeduction: p.chargeDeduction,
    savingsContribution: p.savingsContribution,
    totalDeductions: p.totalDeductions,
    netPay: p.netPay,
    remarks: p.remarks,
    branchBreakdown: p.branchBreakdown,
    daysWorked: p.daysWorked,
    absentDays: p.absentDays,
    dayOffDays: p.dayOffDays,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Payslips</h1>
        <p className="text-sm text-muted-foreground">
          {employee.firstName} {employee.lastName} · {employee.employeeCode}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No payslips yet"
          description="Your payslips will appear here once a payroll period that includes you has been marked as paid."
        />
      ) : (
        <PayslipHistory rows={rows} />
      )}
    </div>
  );
}
