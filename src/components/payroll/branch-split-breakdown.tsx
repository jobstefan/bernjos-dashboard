"use client";

import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
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

  const deficits = branches.filter((b) => b.netCash < 0);
  const surpluses = branches.filter((b) => b.netCash > 0);

  const totalDeficit = deficits.reduce((s, b) => s + Math.abs(b.netCash), 0);
  const totalSurplus = surpluses.reduce((s, b) => s + b.netCash, 0);
  const covered = totalSurplus >= totalDeficit;
  const remainder = Math.round((totalSurplus - totalDeficit) * 100) / 100;

  // For each deficit, list which surplus branches cover it (proportional)
  const cards = deficits.map((deficit) => {
    const need = Math.abs(deficit.netCash);
    const sources = surpluses
      .filter((s) => s.netCash > 0)
      .map((s) => ({
        branchName: s.branchName,
        amount: totalSurplus > 0
          ? Math.round((s.netCash / totalSurplus) * Math.min(need, totalSurplus) * 100) / 100
          : 0,
      }))
      .filter((s) => s.amount > 0);
    return { deficit, need, sources };
  });

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

      {cards.length > 0 && (
        <>
          <Separator />

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cash to disburse
            </div>

            {cards.map(({ deficit, need, sources }) => (
              <div
                key={deficit.branchName}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm"
              >
                {/* Header: Give X to Branch */}
                <div className="flex items-center gap-1.5 text-destructive font-medium">
                  <span>Give</span>
                  <span className="font-mono font-semibold">{formatPeso(need)}</span>
                  <span>to</span>
                  <span className="font-semibold">{deficit.branchName}</span>
                </div>

                {/* Sources */}
                {sources.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    <ArrowRight className="size-3 shrink-0" />
                    <span>from</span>
                    {sources.map((s, i) => (
                      <span key={s.branchName} className="inline-flex items-center gap-1">
                        <span className="font-semibold text-foreground">{s.branchName}</span>
                        <span className="font-mono text-muted-foreground">({formatPeso(s.amount)})</span>
                        {i < sources.length - 1 && <span>and</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Coverage status */}
            <div className={
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs " +
              (covered
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : "border border-destructive/30 bg-destructive/10 text-destructive")
            }>
              {covered
                ? <CheckCircle2 className="size-3.5 shrink-0" />
                : <AlertCircle className="size-3.5 shrink-0" />}
              <span>
                {covered
                  ? <>Covered — <span className="font-mono font-semibold">{formatPeso(totalSurplus)}</span> combined surplus{remainder > 0 && <>, <span className="font-mono">{formatPeso(remainder)}</span> remaining</>}</>
                  : <>Shortfall — <span className="font-mono font-semibold">{formatPeso(Math.abs(remainder))}</span> short across all branches</>}
              </span>
            </div>
          </div>
        </>
      )}

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
