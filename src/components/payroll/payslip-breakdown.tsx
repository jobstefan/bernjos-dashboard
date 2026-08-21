import { AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/utils/payroll";

export interface PayslipView {
  employeeName: string;
  employeeCode: string;
  position: string;
  department: string;
  tin: string | null;
  periodLabel: string;
  basicSalary: number;
  grossPay: number;
  sssEmployee: number;
  philhealthEmployee: number;
  pagibigEmployee: number;
  birWithholding: number;
  otherEarnings: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
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
        {!payslip.tin ? (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            <AlertTriangle className="size-3" /> Missing TIN
          </span>
        ) : null}
      </div>

      <Separator />

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Earnings
        </div>
        <Line label="Basic (monthly)" value={payslip.basicSalary} />
        <Line label="Gross (this cut-off)" value={payslip.grossPay} emphasis />
        {payslip.otherEarnings > 0 ? (
          <Line label="Other earnings" value={payslip.otherEarnings} />
        ) : null}
      </div>

      <Separator />

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Deductions
        </div>
        <Line label="SSS" value={payslip.sssEmployee} negative />
        <Line label="PhilHealth" value={payslip.philhealthEmployee} negative />
        <Line label="Pag-IBIG" value={payslip.pagibigEmployee} negative />
        <Line label="BIR withholding" value={payslip.birWithholding} negative />
        {payslip.otherDeductions > 0 ? (
          <Line label="Other deductions" value={payslip.otherDeductions} negative />
        ) : null}
        <Line label="Total deductions" value={payslip.totalDeductions} emphasis negative />
      </div>

      <Separator />

      <div className="flex items-center justify-between rounded-lg bg-accent px-3 py-3">
        <span className="text-sm font-semibold">Net pay</span>
        <span className="font-mono text-lg font-bold text-primary">
          {formatPeso(payslip.netPay)}
        </span>
      </div>
    </div>
  );
}
