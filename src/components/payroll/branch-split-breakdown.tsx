"use client";

import { ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/utils/payroll";

export interface BranchSplitProps {
  employeeName: string;
  position: string;
  periodLabel: string;
  /** Employee's daily rate (basic salary). Used to compute gross contribution per branch. */
  dailyRate: number;
  /** Sum of SSS + PhilHealth + late deduction + savings contribution for this run item. */
  totalStatutory: number;
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
  dailyRate,
  totalStatutory,
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

  // Largest deficit first — maximises chance each gets single-branch full coverage
  const deficits = branches
    .filter((b) => b.netCash < 0)
    .sort((a, b) => a.netCash - b.netCash);
  const surpluses = branches.filter((b) => b.netCash > 0);

  const totalDeficit = Math.round(deficits.reduce((s, b) => s + Math.abs(b.netCash), 0) * 100) / 100;
  const totalSurplus = Math.round(surpluses.reduce((s, b) => s + b.netCash, 0) * 100) / 100;
  const covered = Math.round(totalSurplus * 100) + 1 >= Math.round(totalDeficit * 100);
  const remainder = Math.round((totalSurplus - totalDeficit) * 100) / 100;

  // ── Phase 1: Net Pay Sourcing ──────────────────────────────────────────────
  // Determine which branch(es) to physically pull the net pay from.
  // Prefer a single branch; pool only when necessary.
  const netPayPool = surpluses.map((s) => ({ branchName: s.branchName, remaining: s.netCash }));
  const netPaySources: { branchName: string; amount: number }[] = [];
  // +1 cent tolerance absorbs per-branch rounding drift (each branch netCash is individually rounded)
  const netPayCovered = Math.round(totalSurplus * 100) + 1 >= Math.round(totalNetPay * 100);

  if (netPayCovered) {
    let stillNeed = Math.round(totalNetPay * 100) / 100;

    // Try smallest single branch that fully covers net pay (preserves larger ones for deficit pool)
    const singleCover = netPayPool
      .filter((s) => s.remaining >= stillNeed)
      .sort((a, b) => a.remaining - b.remaining)[0];

    if (singleCover) {
      netPaySources.push({ branchName: singleCover.branchName, amount: stillNeed });
      singleCover.remaining = Math.round((singleCover.remaining - stillNeed) * 100) / 100;
    } else {
      // Greedy pool from largest-first
      const sorted = [...netPayPool].sort((a, b) => b.remaining - a.remaining);
      for (const entry of sorted) {
        if (stillNeed <= 0) break;
        const poolEntry = netPayPool.find((p) => p.branchName === entry.branchName)!;
        if (poolEntry.remaining <= 0) continue;
        const take = Math.round(Math.min(poolEntry.remaining, stillNeed) * 100) / 100;
        netPaySources.push({ branchName: poolEntry.branchName, amount: take });
        poolEntry.remaining = Math.round((poolEntry.remaining - take) * 100) / 100;
        stillNeed = Math.round((stillNeed - take) * 100) / 100;
      }
    }
  }

  // ── Phase 2: Deficit Coverage (uses what remains in netPayPool after Phase 1) ──
  // pool now holds the remainder after net pay was allocated
  const pool = netPayPool;

  const cards = deficits.map((deficit) => {
    const need = Math.round(Math.abs(deficit.netCash) * 100) / 100;
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
    <div className="space-y-4">
      <div>
        <div className="text-base font-semibold">{employeeName}</div>
        <div className="text-xs text-muted-foreground">{position}</div>
        <div className="mt-1 text-xs text-muted-foreground">{periodLabel}</div>
      </div>

      <Separator />

      {/* Branch table — gross contribution per branch */}
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Branch
        </div>
        {branches.map((b) => {
          const gross = Math.round(b.daysWorked * dailyRate * 100) / 100;
          return (
            <div key={b.branchName} className="flex items-center justify-between py-1.5 text-sm">
              <div>
                <span className="text-foreground">{b.branchName}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {b.daysWorked} day{b.daysWorked !== 1 ? "s" : ""}
                </span>
              </div>
              <span className="font-mono font-medium text-foreground">
                {formatPeso(gross)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Contributions — prefer single branch; split only if none can cover alone */}
      {totalStatutory > 0 && (() => {
        const totalBranchDays = branches.reduce((s, b) => s + b.daysWorked, 0);
        if (totalBranchDays === 0) return null;

        const branchesWithGross = branches.map((b) => ({
          branchName: b.branchName,
          gross: Math.round(b.daysWorked * dailyRate * 100) / 100,
          daysWorked: b.daysWorked,
        }));

        // Try smallest single branch whose gross can cover the full contribution
        const singleCover = branchesWithGross
          .filter((b) => b.gross >= totalStatutory)
          .sort((a, b) => a.gross - b.gross)[0];

        let contribRows: { branchName: string; amount: number }[];
        if (singleCover) {
          contribRows = [{ branchName: singleCover.branchName, amount: totalStatutory }];
        } else {
          // Fall back to proportional split
          let allocated = 0;
          contribRows = branches.map((b, i) => {
            const isLast = i === branches.length - 1;
            const share = isLast
              ? Math.round((totalStatutory - allocated) * 100) / 100
              : Math.round(totalStatutory * (b.daysWorked / totalBranchDays) * 100) / 100;
            allocated = Math.round((allocated + share) * 100) / 100;
            return { branchName: b.branchName, amount: share };
          });
        }
        return (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contributions <span className="normal-case font-normal">(SSS · PhilHealth · Savings)</span>
              </div>
              {contribRows.map((c) => (
                <div key={c.branchName} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                    <span>Get</span>
                    <span className="font-mono font-semibold">{formatPeso(c.amount)}</span>
                    <span>from</span>
                    <span className="font-semibold">{c.branchName}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* Net Pay sourcing — which branch(es) to pull net pay from */}
      <Separator />

      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Net Pay
        </div>

        {netPayCovered ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-1.5 font-medium text-emerald-700">
              <span>Pay</span>
              <span className="font-mono font-semibold">{formatPeso(totalNetPay)}</span>
              <span>to</span>
              <span className="font-semibold">{employeeName}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
              <ArrowRight className="size-3 shrink-0" />
              <span>from</span>
              {netPaySources.map((s, i) => (
                <span key={s.branchName} className="inline-flex items-center gap-1">
                  <span className="font-semibold text-foreground">{s.branchName}</span>
                  {netPaySources.length > 1 && (
                    <span className="font-mono text-muted-foreground">({formatPeso(s.amount)})</span>
                  )}
                  {i < netPaySources.length - 1 && <span>and</span>}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>
              Shortfall — only{" "}
              <span className="font-mono font-semibold">{formatPeso(totalSurplus)}</span>{" "}
              available across all branches, need{" "}
              <span className="font-mono font-semibold">{formatPeso(totalNetPay)}</span>
            </span>
          </div>
        )}
      </div>

      {/* Cash to disburse — inter-branch reimbursement with the remainder */}
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
                <div className="flex items-center gap-1.5 text-destructive font-medium">
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
