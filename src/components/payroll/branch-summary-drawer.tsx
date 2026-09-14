"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
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

  // Step 2 — net cash per branch (for display in branch table only)
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

  // Step 3 — merged, sorted branch list for the table
  const branches = [...new Set([...netPayMap.keys(), ...netCashMap.keys()])]
    .sort()
    .map((name) => ({
      branchName: name,
      totalNetPay: netPayMap.get(name) ?? 0,
      totalNetCash: netCashMap.get(name) ?? 0,
    }));

  const runTotalNetPay = Math.round(includedRows.reduce((s, r) => s + r.netPay, 0) * 100) / 100;

  // Step 4 — aggregate per-employee Phase 1+2 to get cash-to-disburse totals per deficit branch
  type DisbursementEntry = { sourceBranch: string; amount: number };
  const disbursementMap = new Map<string, DisbursementEntry[]>(); // deficitBranch → sources[]

  for (const row of includedRows) {
    const empBranches = row.branchBreakdown.map((b) => {
      const netCash =
        branchCash
          ?.find((bc) => bc.branchName === b.branchName)
          ?.employees.find((e) => e.profileId === row.employeeId)
          ?.netCash ?? b.netPay;
      return { branchName: b.branchName, netCash };
    });

    const empDeficits = empBranches.filter((b) => b.netCash < 0).sort((a, b) => a.netCash - b.netCash);
    const empSurpluses = empBranches.filter((b) => b.netCash > 0);
    if (empDeficits.length === 0) continue;

    const totalSurplus = Math.round(empSurpluses.reduce((s, b) => s + b.netCash, 0) * 100) / 100;
    // Skip if surplus can't cover net pay (shortfall employee)
    if (Math.round(totalSurplus * 100) + 1 < Math.round(row.netPay * 100)) continue;

    // Phase 1: consume net pay from surplus pool
    const pool = empSurpluses.map((s) => ({ branchName: s.branchName, remaining: s.netCash }));
    let stillNeed = Math.round(row.netPay * 100) / 100;
    const singleCoverP1 = pool
      .filter((s) => s.remaining >= stillNeed)
      .sort((a, b) => a.remaining - b.remaining)[0];
    if (singleCoverP1) {
      singleCoverP1.remaining = Math.round((singleCoverP1.remaining - stillNeed) * 100) / 100;
    } else {
      for (const entry of [...pool].sort((a, b) => b.remaining - a.remaining)) {
        if (stillNeed <= 0) break;
        const take = Math.round(Math.min(entry.remaining, stillNeed) * 100) / 100;
        entry.remaining = Math.round((entry.remaining - take) * 100) / 100;
        stillNeed = Math.round((stillNeed - take) * 100) / 100;
      }
    }

    // Phase 2: cover deficits from remaining pool, collect disbursements
    for (const deficit of empDeficits) {
      const need = Math.round(Math.abs(deficit.netCash) * 100) / 100;
      const sources: { branchName: string; amount: number }[] = [];

      const singleCoverP2 = pool
        .filter((s) => s.remaining >= need)
        .sort((a, b) => a.remaining - b.remaining)[0];
      if (singleCoverP2) {
        sources.push({ branchName: singleCoverP2.branchName, amount: need });
        singleCoverP2.remaining = Math.round((singleCoverP2.remaining - need) * 100) / 100;
      } else {
        let sn = need;
        for (const entry of [...pool].sort((a, b) => b.remaining - a.remaining)) {
          if (sn <= 0) break;
          if (entry.remaining <= 0) continue;
          const take = Math.round(Math.min(entry.remaining, sn) * 100) / 100;
          sources.push({ branchName: entry.branchName, amount: take });
          entry.remaining = Math.round((entry.remaining - take) * 100) / 100;
          sn = Math.round((sn - take) * 100) / 100;
        }
      }

      if (sources.length > 0) {
        const existing = disbursementMap.get(deficit.branchName) ?? [];
        for (const s of sources) {
          const match = existing.find((e) => e.sourceBranch === s.branchName);
          if (match) {
            match.amount = Math.round((match.amount + s.amount) * 100) / 100;
          } else {
            existing.push({ sourceBranch: s.branchName, amount: s.amount });
          }
        }
        disbursementMap.set(deficit.branchName, existing);
      }
    }
  }

  const disbursementTotal = Math.round(
    [...disbursementMap.values()].flatMap((v) => v).reduce((s, e) => s + e.amount, 0) * 100
  ) / 100;

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
            {disbursementMap.size > 0 && (
              <>
                <Separator />

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cash to disburse
                  </div>

                  {[...disbursementMap.entries()]
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([deficitBranch, sources]) => {
                      const total = Math.round(sources.reduce((s, e) => s + e.amount, 0) * 100) / 100;
                      return (
                        <div
                          key={deficitBranch}
                          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm"
                        >
                          <div className="flex items-center gap-1.5 font-medium text-destructive">
                            <span>Give</span>
                            <span className="font-mono font-semibold">{formatPeso(total)}</span>
                            <span>to</span>
                            <span className="font-semibold">{deficitBranch}</span>
                          </div>

                          {sources.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                              <ArrowRight className="size-3 shrink-0" />
                              <span>from</span>
                              {sources.map((s, i) => (
                                <span key={s.sourceBranch} className="inline-flex items-center gap-1">
                                  <span className="font-semibold text-foreground">{s.sourceBranch}</span>
                                  {sources.length > 1 && (
                                    <span className="font-mono text-muted-foreground">({formatPeso(s.amount)})</span>
                                  )}
                                  {i < sources.length - 1 && <span>and</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    <span>
                      Total —{" "}
                      <span className="font-mono font-semibold">{formatPeso(disbursementTotal)}</span>{" "}
                      to disburse across all branches
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
