"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { formatPeso } from "@/lib/utils/payroll";
import type { BranchSummaryLine } from "@/lib/types/payroll";

function computeBalance(e: BranchSummaryLine) {
  return e.grossShare - e.netPay - e.charges - e.loanRepayments - e.cashAdvances - e.incentives;
}

/** Greedy matching of surplus branches covering shortfall branches. */
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
  const hasData = summary && summary.length > 0;
  const transfers = hasData ? computeTransfers(summary) : [];

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
        description="Gross share vs total expenses per branch. A negative balance means that branch needs funds from a surplus branch."
      >
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No branch data for this period.
          </p>
        ) : (
          <div className="space-y-4 pt-2">
            {summary.map((e) => {
              const balance = computeBalance(e);
              const isShort = balance < -0.005;
              return (
                <div key={e.branchId ?? "unassigned"} className="rounded-lg border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{e.branchName}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.employeeCount} employee{e.employeeCount === 1 ? "" : "s"} ·{" "}
                        {e.daysWorked.toFixed(1)} day{e.daysWorked === 1 ? "" : "s"} worked
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Gross share</p>
                      <p className="font-mono text-sm font-semibold">{formatPeso(e.grossShare)}</p>
                    </div>
                  </div>

                  <div className="space-y-1 border-t pt-2">
                    <ExpenseLine label="Net pay to employees" value={e.netPay} />
                    {e.charges > 0 && <ExpenseLine label="Charges" value={e.charges} />}
                    {e.loanRepayments > 0 && <ExpenseLine label="Loan repayments" value={e.loanRepayments} />}
                    {e.cashAdvances > 0 && <ExpenseLine label="Cash advances" value={e.cashAdvances} />}
                    {e.incentives > 0 && <ExpenseLine label="Incentives" value={e.incentives} />}
                  </div>

                  <div className={
                    "flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold " +
                    (isShort ? "bg-destructive/10 text-destructive" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400")
                  }>
                    <span>{isShort ? "Shortfall — needs transfer in" : "Surplus"}</span>
                    <span className="font-mono">{isShort ? `-${formatPeso(-balance)}` : formatPeso(balance)}</span>
                  </div>
                </div>
              );
            })}

            {transfers.length > 0 && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Transfers needed
                </p>
                {transfers.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">{t.from}</span>
                      {" → "}
                      <span className="font-medium text-destructive">{t.to}</span>
                    </span>
                    <span className="font-mono">{formatPeso(t.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </>
  );
}

function ExpenseLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-destructive">-{formatPeso(value)}</span>
    </div>
  );
}
