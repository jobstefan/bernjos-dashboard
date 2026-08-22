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
  otherDeductions: number;
  savingsContribution: number;
  totalDeductions: number;
  netPay: number;
  remarks?: string | null;
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
        <Line label="Gross (this period)" value={payslip.grossPay} emphasis />
        {payslip.otherEarnings > 0 ? (
          <Line label="Other earnings" value={payslip.otherEarnings} />
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
        {payslip.otherDeductions > 0 ? (
          <Line label="Other deductions" value={payslip.otherDeductions} negative />
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

      <Separator />

      <div className="flex items-center justify-between rounded-lg bg-accent px-3 py-3">
        <span className="text-sm font-semibold">Net pay</span>
        <span className="font-mono text-lg font-bold text-primary">
          {formatPeso(payslip.netPay)}
        </span>
      </div>

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
