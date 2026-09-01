"use client";

import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/utils/payroll";

export interface BranchSplitProps {
  employeeName: string;
  position: string;
  periodLabel: string;
  branches: {
    branchName: string;
    daysWorked: number;
    netPay: number;
    /** Actual branch cash responsibility (gross share minus branch-tagged finance). Falls back to netPay if unavailable. */
    netCash: number;
  }[];
  totalNetPay: number;
}

export function BranchSplitBreakdown({
  employeeName,
  position,
  periodLabel,
  branches,
  totalNetPay,
}: BranchSplitProps) {
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
