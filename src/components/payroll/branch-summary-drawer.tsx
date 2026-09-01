"use client";

import * as React from "react";
import { Building2, ArrowRight, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { formatPeso } from "@/lib/utils/payroll";
import { cn } from "@/lib/utils";
import type { BranchSummaryLine } from "@/lib/types/payroll";

function computeBalance(e: BranchSummaryLine) {
  return e.grossShare - e.netCash;
}

function computeTransfers(lines: BranchSummaryLine[]) {
  const shortfalls = lines
    .map((e) => ({ name: e.branchName, amount: -computeBalance(e) }))
    .filter((e) => e.amount > 0.005)
    .sort((a, b) => b.amount - a.amount);

  const surpluses = lines
    .map((e) => ({ name: e.branchName, remaining: computeBalance(e) }))
    .filter((e) => e.remaining > 0.005)
    .sort((a, b) => b.remaining - a.remaining);

  const transfers: { from: string; to: string; amount: number }[] = [];
  for (const shortfall of shortfalls) {
    let need = shortfall.amount;
    for (const surplus of surpluses) {
      if (surplus.remaining <= 0.005 || need <= 0.005) continue;
      const take = Math.min(need, surplus.remaining);
      transfers.push({ from: surplus.name, to: shortfall.name, amount: Math.round(take * 100) / 100 });
      surplus.remaining -= take;
      need -= take;
    }
  }
  return transfers;
}

export function BranchSummaryDrawer({ summary }: { summary?: BranchSummaryLine[] }) {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const hasData = summary && summary.length > 0;
  const transfers = hasData ? computeTransfers(summary) : [];

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Building2 className="mr-2 size-4" />
        Branch Summary
      </Button>

      <DetailDrawer
        open={open}
        onOpenChange={setOpen}
        title="Branch Summary"
        description="Cash each branch needs to prepare for payroll."
        className="sm:max-w-lg"
      >
        {!hasData ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Building2 className="size-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No branch data for this period.</p>
            <p className="text-xs text-muted-foreground">Run payroll calculation first.</p>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {summary.map((e) => {
              const balance = computeBalance(e);
              const isShort = balance < -0.005;
              const key = e.branchId ?? "__null__";
              const isExpanded = expanded.has(key);

              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border bg-card overflow-hidden",
                    isShort ? "border-destructive/50" : "border-border",
                  )}
                >
                  {/* Branch header */}
                  <div className="px-4 pt-3 pb-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{e.branchName}</p>
                      <Badge variant={isShort ? "destructive" : "secondary"} className="shrink-0">
                        {isShort ? "Shortfall" : "OK"}
                      </Badge>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                      <span className="text-muted-foreground">Gross share</span>
                      <span className="font-mono text-right">{formatPeso(e.grossShare)}</span>

                      <span className="text-muted-foreground">Cash to employees</span>
                      <span className="font-mono text-right">−{formatPeso(e.netCash)}</span>

                      <span className="font-medium">{isShort ? "Shortfall" : "Balance"}</span>
                      <span className={cn(
                        "font-mono font-bold text-right",
                        isShort ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                      )}>
                        {isShort ? `-${formatPeso(-balance)}` : formatPeso(balance)}
                      </span>
                    </div>
                  </div>

                  {/* Employee toggle */}
                  <button
                    onClick={() => toggleExpanded(key)}
                    className="flex w-full items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground hover:bg-muted/40 active:bg-muted/60 transition-colors min-h-[40px]"
                    aria-expanded={isExpanded}
                  >
                    <span>{e.employeeCount} employee{e.employeeCount === 1 ? "" : "s"} · {e.daysWorked.toFixed(1)} days</span>
                    {isExpanded ? <ChevronUp className="size-3.5 shrink-0" /> : <ChevronDown className="size-3.5 shrink-0" />}
                  </button>

                  {/* Employee rows */}
                  {isExpanded && (
                    <div className="border-t divide-y divide-border/50 bg-muted/20">
                      {e.employees.map((emp) => {
                        const isDeductionExcess = emp.netCash < -0.005;
                        return (
                          <div key={emp.employeeId} className="flex items-center gap-3 px-4 py-2 min-h-[36px]">
                            <span className="text-xs font-medium truncate flex-1">{emp.employeeName}</span>
                            <span className="text-xs text-muted-foreground shrink-0">{emp.daysWorked.toFixed(1)}d</span>
                            {isDeductionExcess ? (
                              <span className="text-xs text-muted-foreground italic shrink-0">deduction excess</span>
                            ) : (
                              <span className="font-mono text-xs font-semibold shrink-0">{formatPeso(emp.netCash)}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Transfers */}
            {transfers.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-900/50">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                    Transfers needed before release
                  </p>
                  <p className="text-xs text-amber-700/70 dark:text-amber-500/70 mt-0.5">
                    Move funds between branches to cover shortfalls.
                  </p>
                </div>
                <div className="divide-y divide-amber-200/60 dark:divide-amber-900/30">
                  {transfers.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 px-4 py-3 min-h-[44px]">
                      <div className="flex-1 flex items-center gap-1.5 min-w-0 flex-wrap">
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 truncate">
                          {t.from}
                        </span>
                        <ArrowRight className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium text-destructive truncate">
                          {t.to}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold shrink-0">
                        {formatPeso(t.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
