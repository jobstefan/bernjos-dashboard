"use client";

import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/utils/payroll";
import type { RunItemRow } from "@/components/payroll/run-items-table";
import type { BranchCashRow } from "@/server/services/analytics.service";

interface BranchSummaryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periodLabel: string;
  rows: RunItemRow[];
  branchCash: BranchCashRow[] | undefined;
}

export function BranchSummaryDrawer({
  open,
  onOpenChange,
  periodLabel,
  rows,
  branchCash,
}: BranchSummaryDrawerProps) {
  const includedRows = rows.filter((r) => r.status === "included");

  // Step 1 — net pay per branch from branch breakdown
  const netPayMap = new Map<string, number>();
  for (const row of includedRows) {
    for (const b of row.branchBreakdown) {
      netPayMap.set(b.branchName, Math.round(((netPayMap.get(b.branchName) ?? 0) + b.netPay) * 100) / 100);
    }
  }

  // Step 2 — net cash per branch from branchCash (covers included employees via profileId filtering)
  const netCashMap = new Map<string, number>();
  const includedIds = new Set(includedRows.map((r) => r.employeeId));
  for (const bcRow of branchCash ?? []) {
    const total = bcRow.employees
      .filter((e) => includedIds.has(e.profileId))
      .reduce((s, e) => s + e.netCash, 0);
    if (total !== 0) {
      netCashMap.set(bcRow.branchName, Math.round(total * 100) / 100);
    }
  }

  // Step 3 — merged, sorted branch list
  const branches = [...new Set([...netPayMap.keys(), ...netCashMap.keys()])]
    .sort()
    .map((name) => ({
      branchName: name,
      totalNetPay: netPayMap.get(name) ?? 0,
      totalNetCash: netCashMap.get(name) ?? 0,
    }));

  const runTotalNetPay = Math.round(includedRows.reduce((s, r) => s + r.netPay, 0) * 100) / 100;

  // Step 4 — cash to disburse (greedy deficit coverage, same as BranchSplitBreakdown Phase 2)
  const deficits = branches
    .filter((b) => b.totalNetCash < 0)
    .sort((a, b) => a.totalNetCash - b.totalNetCash);
  const surpluses = branches.filter((b) => b.totalNetCash > 0);

  const totalDeficit = Math.round(deficits.reduce((s, b) => s + Math.abs(b.totalNetCash), 0) * 100) / 100;
  const totalSurplus = Math.round(surpluses.reduce((s, b) => s + b.totalNetCash, 0) * 100) / 100;
  const covered = totalSurplus >= totalDeficit;
  const remainder = Math.round((totalSurplus - totalDeficit) * 100) / 100;

  const pool = surpluses.map((s) => ({ branchName: s.branchName, remaining: s.totalNetCash }));

  const cards = deficits.map((deficit) => {
    const need = Math.round(Math.abs(deficit.totalNetCash) * 100) / 100;
    const sources: { branchName: string; amount: number }[] = [];

    const fullCover = pool
      .filter((s) => s.remaining >= need)
      .sort((a, b) => a.remaining - b.remaining)[0];

    if (fullCover) {
      sources.push({ branchName: fullCover.branchName, amount: need });
      fullCover.remaining = Math.round((fullCover.remaining - need) * 100) / 100;
    } else {
      let stillNeed = need;
      const sorted = [...pool].sort((a, b) => b.remaining - a.remaining);
      for (const entry of sorted) {
        if (stillNeed <= 0) break;
        const poolEntry = pool.find((p) => p.branchName === entry.branchName)!;
        if (poolEntry.remaining <= 0) continue;
        const take = Math.round(Math.min(poolEntry.remaining, stillNeed) * 100) / 100;
        sources.push({ branchName: poolEntry.branchName, amount: take });
        poolEntry.remaining = Math.round((poolEntry.remaining - take) * 100) / 100;
        stillNeed = Math.round((stillNeed - take) * 100) / 100;
      }
    }

    return { deficit, need, sources };
  });

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Branch Summary"
      description={periodLabel}
    >
      <div className="space-y-4 pt-2">
        {branches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No branch data available for this period.</p>
        ) : (
          <>
            {/* Branch table */}
            <div>
              <div className="mb-1 grid grid-cols-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Branch</span>
                <span className="text-right">Net Pay</span>
                <span className="text-right">Net Cash</span>
              </div>
              {branches.map((b) => (
                <div key={b.branchName} className="grid grid-cols-3 items-center py-1.5 text-sm">
                  <span className="text-foreground">{b.branchName}</span>
                  <span className="text-right font-mono text-muted-foreground">
                    {formatPeso(b.totalNetPay)}
                  </span>
                  <span className={
                    "text-right font-mono font-medium " +
                    (b.totalNetCash < 0 ? "text-destructive" : "text-foreground")
                  }>
                    {b.totalNetCash < 0 ? "-" : ""}{formatPeso(Math.abs(b.totalNetCash))}
                  </span>
                </div>
              ))}
            </div>

            {/* Cash to disburse */}
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
                      <div className="flex items-center gap-1.5 font-medium text-destructive">
                        <span>Give</span>
                        <span className="font-mono font-semibold">{formatPeso(need)}</span>
                        <span>to</span>
                        <span className="font-semibold">{deficit.branchName}</span>
                      </div>

                      {sources.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                          <ArrowRight className="size-3 shrink-0" />
                          <span>from</span>
                          {sources.map((s, i) => (
                            <span key={s.branchName} className="inline-flex items-center gap-1">
                              <span className="font-semibold text-foreground">{s.branchName}</span>
                              {sources.length > 1 && (
                                <span className="font-mono text-muted-foreground">({formatPeso(s.amount)})</span>
                              )}
                              {i < sources.length - 1 && <span>and</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

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
              <span className="text-sm font-semibold text-foreground">Total Net Pay</span>
              <span className="font-mono text-xl font-bold text-foreground">
                {formatPeso(runTotalNetPay)}
              </span>
            </div>
          </>
        )}
      </div>
    </DetailDrawer>
  );
}
