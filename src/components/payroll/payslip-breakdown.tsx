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
  lateMinutes?: number;
  undertimeMinutes?: number;
  breakMinutes?: number;
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
  /** Scheduled days the employee did not attend (only set when attendance-tracked). */
  absentDays?: number;
  /** Calendar days in the period with no scheduled shift. */
  dayOffDays?: number;
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
          {payslip.periodLabel} · {formatPeso(payslip.basicSalary)}/day
        </div>
      </div>

      <Separator />

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Earnings
        </div>
        <Line label="Gross" value={payslip.grossPay} />
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

      {((payslip.absentDays ?? 0) > 0 || (payslip.dayOffDays ?? 0) > 0) ? (
        <>
          <Separator />
          <div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Attendance
            </div>
            {(payslip.absentDays ?? 0) > 0 ? (
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-muted-foreground">Absent</span>
                <span className="text-foreground">{payslip.absentDays} day{payslip.absentDays === 1 ? "" : "s"}</span>
              </div>
            ) : null}
            {(payslip.dayOffDays ?? 0) > 0 ? (
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-muted-foreground">Day-off</span>
                <span className="text-foreground">{payslip.dayOffDays} day{payslip.dayOffDays === 1 ? "" : "s"}</span>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

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
        {(payslip.lateDeduction ?? 0) > 0 ? (() => {
          const late = payslip.lateMinutes ?? 0;
          const under = payslip.undertimeMinutes ?? 0;
          const brk = payslip.breakMinutes ?? 0;
          const total = payslip.lateDeduction!;
          const totalMin = late + under + brk;
          // Pro-rate the peso amount per component so lines sum to total.
          const share = (min: number) =>
            totalMin > 0 ? Math.round(total * min / totalMin * 100) / 100 : 0;
          const lateAmt  = share(late);
          const underAmt = share(under);
          // Last component absorbs rounding remainder.
          const brkAmt   = totalMin > 0 ? Math.round((total - lateAmt - underAmt) * 100) / 100 : 0;
          return (
            <>
              {late  > 0 ? <Line label={`Late (${late} min)`}          value={lateAmt}  negative /> : null}
              {under > 0 ? <Line label={`Undertime (${under} min)`}    value={underAmt} negative /> : null}
              {brk   > 0 ? <Line label={`Out (${brk} min)`}    value={brkAmt}   negative /> : null}
              {totalMin === 0 ? <Line label="Late / undertime" value={total} negative /> : null}
            </>
          );
        })() : null}
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

      <Separator />
      <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Net Pay</span>
        <span className="font-mono text-xl font-bold text-foreground">
          {formatPeso(payslip.netPay)}
        </span>
      </div>
    </div>
  );
}
