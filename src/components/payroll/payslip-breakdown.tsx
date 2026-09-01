import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/utils/payroll";

export interface PayslipView {
  employeeName: string;
  employeeCode: string;
  position: string;
  department: string;
  periodLabel: string;
  basicSalary: number;
  grossPay: number;
  sssEmployee: number;
  philhealthEmployee: number;
  otherEarnings: number;
  incentiveEarnings?: number;
  overtimeMinutes?: number;
  lateDeduction?: number;
  advanceDeduction?: number;
  otherDeductions: number;
  loanDeduction?: number;
  chargeDeduction?: number;
  savingsContribution: number;
  totalDeductions: number;
  netPay: number;
  remarks?: string | null;
  /** Net pay attributed to each branch worked (net × its day-share). */
  branchBreakdown?: {
    branchName: string;
    daysWorked: number;
    netPay: number;
  }[];
}

function Line({
  label,
  value,
  emphasis,
  negative,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={emphasis ? "font-medium text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span
        className={
          "font-mono " +
          (emphasis ? "font-semibold text-foreground" : "text-foreground")
        }
      >
        {negative && value > 0 ? "-" : ""}
        {formatPeso(value)}
      </span>
    </div>
  );
}

export function PayslipBreakdown({ payslip }: { payslip: PayslipView }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-base font-semibold">{payslip.employeeName}</div>
        <div className="text-xs text-muted-foreground">
          {payslip.employeeCode} · {payslip.position} · {payslip.department}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {payslip.periodLabel}
        </div>
      </div>

      <Separator />

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Earnings
        </div>
        <Line label="Basic (daily rate)" value={payslip.basicSalary} />
        {payslip.otherEarnings > 0 ? (
          <Line
            label={`Overtime${payslip.overtimeMinutes ? ` (${payslip.overtimeMinutes} min)` : ""}`}
            value={payslip.otherEarnings}
          />
        ) : null}
        {(payslip.incentiveEarnings ?? 0) > 0 ? (
          <Line label="Incentive" value={payslip.incentiveEarnings!} />
        ) : null}
      </div>

      <Separator />

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Deductions
        </div>
        {payslip.sssEmployee > 0 ? (
          <Line label="SSS" value={payslip.sssEmployee} negative />
        ) : null}
        {payslip.philhealthEmployee > 0 ? (
          <Line label="PhilHealth" value={payslip.philhealthEmployee} negative />
        ) : null}
        {(payslip.lateDeduction ?? 0) > 0 ? (
          <Line label="Late / undertime" value={payslip.lateDeduction!} negative />
        ) : null}
        {(payslip.advanceDeduction ?? 0) > 0 ? (
          <Line label="Cash advances" value={payslip.advanceDeduction!} negative />
        ) : null}
        {payslip.otherDeductions > 0 &&
        (payslip.lateDeduction ?? 0) === 0 &&
        (payslip.advanceDeduction ?? 0) === 0 ? (
          <Line label="Other deductions" value={payslip.otherDeductions} negative />
        ) : null}
        {(payslip.loanDeduction ?? 0) > 0 ? (
          <Line label="Loan repayment" value={payslip.loanDeduction!} negative />
        ) : null}
        {(payslip.chargeDeduction ?? 0) > 0 ? (
          <Line label="Charges" value={payslip.chargeDeduction!} negative />
        ) : null}
        <Line label="Total deductions" value={payslip.totalDeductions} emphasis negative />
      </div>

      {payslip.savingsContribution > 0 ? (
        <>
          <Separator />
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Savings
            </div>
            <Line
              label="Savings contribution"
              value={payslip.savingsContribution}
              negative
            />
            <p className="pt-1 text-xs text-muted-foreground">
              Held in your savings account — this is your money, not a deduction.
            </p>
          </div>
        </>
      ) : null}

      {payslip.branchBreakdown && payslip.branchBreakdown.length > 0 ? (
        <>
          <Separator />
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Net pay by branch
            </div>
            {payslip.branchBreakdown.map((b, i) => (
              <Line
                key={`${b.branchName}-${i}`}
                label={`${b.branchName} (${b.daysWorked} day${b.daysWorked === 1 ? "" : "s"})`}
                value={b.netPay}
              />
            ))}
            <Line label="Net pay" value={payslip.netPay} emphasis />
            <p className="pt-1 text-xs text-muted-foreground">
              Take-home split by branch worked — pull each amount from that branch.
            </p>
          </div>
        </>
      ) : null}

      {payslip.remarks ? (
        <>
          <Separator />
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Remarks
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {payslip.remarks}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}
