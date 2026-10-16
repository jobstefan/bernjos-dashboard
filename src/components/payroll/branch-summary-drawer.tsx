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

  type BranchEmpRow = { name: string; daysWorked: number; gross: number; contrib: number; netCash: number };
  type BranchEntry = { totalGross: number; totalContrib: number; totalNetCash: number; employees: BranchEmpRow[] };

  // Build per-branch employee breakdown in one pass
  const branchMap2 = new Map<string, BranchEntry>();
  for (const row of includedRows) {
    const totalDays = row.branchBreakdown.reduce((s, b) => s + b.daysWorked, 0);
    if (totalDays === 0) continue;
    const statutory = row.sssEmployee + row.philhealthEmployee + row.lateDeduction + row.savingsContribution;
    let allocatedContrib = 0;
    row.branchBreakdown.forEach((b, i) => {
      const isLast = i === row.branchBreakdown.length - 1;
      const gross = Math.round(b.daysWorked * row.basicSalary * 100) / 100;
      const contrib = isLast
        ? Math.round((statutory - allocatedContrib) * 100) / 100
        : Math.round(statutory * (b.daysWorked / totalDays) * 100) / 100;
      allocatedContrib = Math.round((allocatedContrib + contrib) * 100) / 100;
      const netCash =
        branchCash
          ?.find((bc) => bc.branchName === b.branchName)
          ?.employees.find((e) => e.profileId === row.employeeId)
          ?.netCash ?? b.netPay;
      const entry = branchMap2.get(b.branchName) ?? { totalGross: 0, totalContrib: 0, totalNetCash: 0, employees: [] };
      entry.totalGross = Math.round((entry.totalGross + gross) * 100) / 100;
      entry.totalContrib = Math.round((entry.totalContrib + contrib) * 100) / 100;
      entry.totalNetCash = Math.round((entry.totalNetCash + netCash) * 100) / 100;
      entry.employees.push({ name: row.employeeName, daysWorked: b.daysWorked, gross, contrib, netCash });
      branchMap2.set(b.branchName, entry);
    });
  }

  const branches = [...branchMap2.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, entry]) => ({
      branchName: name,
      ...entry,
      employees: [...entry.employees].sort((a, b) => a.name.localeCompare(b.name)),
    }));

  const runTotalNetPay = Math.round(includedRows.reduce((s, r) => s + r.netPay, 0) * 100) / 100;
  const runTotalGross = Math.round(includedRows.reduce((s, r) => s + r.grossPay, 0) * 100) / 100;

  // net pay per branch (for disbursement logic below)
  const netPayMap = new Map<string, number>();
  for (const row of includedRows) {
    for (const b of row.branchBreakdown) {
      netPayMap.set(b.branchName, Math.round(((netPayMap.get(b.branchName) ?? 0) + b.netPay) * 100) / 100);
    }
  }
  const includedIds = new Set(includedRows.map((r) => r.employeeId));

  // Step 5 — aggregate per-employee Phase 1+2 to get cash-to-disburse totals per deficit branch
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
            {/* Branch table with per-employee rows */}
            <div className="space-y-4">
              {branches.map((branch) => (
                <div key={branch.branchName}>
                  {/* Branch header */}
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {branch.branchName}
                    </span>
                  </div>
                  {/* Column headers */}
                  <div className="mb-0.5 grid grid-cols-4 text-xs text-muted-foreground/70">
                    <span>Employee</span>
                    <span className="text-right">Gross</span>
                    <span className="text-right">Contribs</span>
                    <span className="text-right">Net Cash</span>
                  </div>
                  {/* Employee rows */}
                  {branch.employees.map((emp) => (
                    <div key={emp.name} className="grid grid-cols-4 items-baseline py-1 text-sm border-b border-border/40 last:border-0">
                      <div>
                        <span className="text-foreground">{emp.name}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{emp.daysWorked}d</span>
                      </div>
                      <span className="text-right font-mono text-foreground">
                        {formatPeso(emp.gross)}
                      </span>
                      <span className="text-right font-mono text-amber-700 dark:text-amber-400">
                        -{formatPeso(emp.contrib)}
                      </span>
                      <span className={
                        "text-right font-mono font-medium " +
                        (emp.netCash < 0 ? "text-destructive" : "text-foreground")
                      }>
                        {emp.netCash < 0 ? "-" : ""}{formatPeso(Math.abs(emp.netCash))}
                      </span>
                    </div>
                  ))}
                  {/* Branch total */}
                  <div className="grid grid-cols-4 items-baseline pt-1.5 text-sm font-semibold">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">Total</span>
                    <span className="text-right font-mono text-foreground">
                      {formatPeso(branch.totalGross)}
                    </span>
                    <span className="text-right font-mono text-amber-700 dark:text-amber-400">
                      -{formatPeso(branch.totalContrib)}
                    </span>
                    <span className={
                      "text-right font-mono " +
                      (branch.totalNetCash < 0 ? "text-destructive" : "text-foreground")
                    }>
                      {branch.totalNetCash < 0 ? "-" : ""}{formatPeso(Math.abs(branch.totalNetCash))}
                    </span>
                  </div>
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

            <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Total Gross</span>
                <span className="font-mono text-lg font-bold text-foreground">
                  {formatPeso(runTotalGross)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Net Pay</span>
                <span className="font-mono text-lg font-semibold text-foreground">
                  {formatPeso(runTotalNetPay)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </DetailDrawer>
  );
}
