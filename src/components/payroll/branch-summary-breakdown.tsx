"use client";

import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/utils/payroll";
import type { BranchSummaryRow } from "@/server/services/analytics.service";

export interface EmployeeBranchSplitProps {
  employeeName: string;
  position: string;
  periodLabel: string;
  branches: {
    branchName: string;
    daysWorked: number;
    grossShare: number;
    cashAdvance: number;
    loanRepayment: number;
    charges: number;
    incentives: number;
    netCash: number;
  }[];
  totalNetPay: number;
}

export function EmployeeBranchSplit({
  employeeName,
  position,
  periodLabel,
  branches,
  totalNetPay,
}: EmployeeBranchSplitProps) {
  if (branches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No branch data available for this employee.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-base font-semibold">{employeeName}</div>
        <div className="text-xs text-muted-foreground">{position}</div>
        <div className="mt-1 text-xs text-muted-foreground">{periodLabel}</div>
      </div>

      <Separator />

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Branch
        </div>

        {branches.map((b) => (
          <div key={b.branchName} className="flex items-center justify-between py-1.5 text-sm">
            <div>
              <span className="text-foreground">{b.branchName}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                {b.daysWorked} day{b.daysWorked !== 1 ? "s" : ""}
              </span>
            </div>
            <span className={
              "font-mono font-medium " +
              (b.netCash < 0 ? "text-destructive" : "text-foreground")
            }>
              {b.netCash < 0 ? "-" : ""}{formatPeso(Math.abs(b.netCash))}
            </span>
          </div>
        ))}
      </div>

      <Separator />

      <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Net Pay</span>
        <span className="font-mono text-xl font-bold text-foreground">
          {formatPeso(totalNetPay)}
        </span>
      </div>
    </div>
  );
}

/** Extract this employee's branch lines from the period-level summary. */
export function getEmployeeBranches(
  branchSummary: BranchSummaryRow[],
  profileId: string,
) {
  const result: EmployeeBranchSplitProps["branches"] = [];
  for (const row of branchSummary) {
    const line = row.employees.find((e) => e.profileId === profileId);
    if (line) {
      result.push({
        branchName: row.branchName,
        daysWorked: line.daysWorked,
        grossShare: line.grossShare,
        cashAdvance: line.cashAdvance,
        loanRepayment: line.loanRepayment,
        charges: line.charges,
        incentives: line.incentives,
        netCash: line.netCash,
      });
    }
  }
  return result;
}
