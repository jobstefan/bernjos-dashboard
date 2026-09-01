"use client";

import { AlertTriangle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/utils/payroll";
import type { BranchSummaryRow } from "@/server/services/analytics.service";

interface Transfer { from: string; to: string; amount: number }

function computeTransfers(rows: BranchSummaryRow[]): Transfer[] {
  const surplus = rows
    .filter((r) => r.netCash > 0)
    .map((r) => ({ name: r.branchName, remaining: r.netCash }));
  const transfers: Transfer[] = [];
  for (const def of rows.filter((r) => r.netCash < 0)) {
    let need = Math.abs(def.netCash);
    for (const src of surplus) {
      if (src.remaining <= 0 || need <= 0) continue;
      const take = Math.min(src.remaining, need);
      transfers.push({ from: src.name, to: def.branchName, amount: Math.round(take * 100) / 100 });
      src.remaining -= take;
      need -= take;
    }
  }
  return transfers;
}

function Line({ label, value, emphasis, deficit }: {
  label: string;
  value: number;
  emphasis?: boolean;
  deficit?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={emphasis ? "font-medium text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={`font-mono ${emphasis ? "font-semibold" : ""} ${deficit && value < 0 ? "text-destructive" : ""}`}>
        {value < 0 ? "-" : ""}{formatPeso(Math.abs(value))}
      </span>
    </div>
  );
}

export function BranchSummaryBreakdown({ rows }: { rows: BranchSummaryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No branch data. Calculate the run first.</p>;
  }

  const overall = rows.reduce((s, r) => s + r.netCash, 0);
  const transfers = computeTransfers(rows);

  return (
    <div className="space-y-4">
      {rows.map((row, i) => {
        const isDeficit = row.netCash < 0;
        return (
          <div key={row.branchId ?? "unassigned"}>
            {i > 0 && <Separator className="mb-4" />}

            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {row.branchName}
            </div>

            {row.employees.map((emp) => (
              <Line
                key={emp.profileId}
                label={emp.employeeName}
                value={emp.netCash}
                deficit
              />
            ))}

            <div className={`mt-2 rounded-lg px-4 py-3 flex items-center justify-between ${
              isDeficit ? "bg-destructive/10" : "bg-muted/50"
            }`}>
              <span className={`text-sm font-semibold flex items-center gap-1.5 ${isDeficit ? "text-destructive" : "text-foreground"}`}>
                {isDeficit && <AlertTriangle className="size-3.5" />}
                {isDeficit ? "Deficit" : "Branch Total"}
              </span>
              <span className={`font-mono text-base font-bold ${isDeficit ? "text-destructive" : "text-foreground"}`}>
                {row.netCash < 0 ? "-" : ""}{formatPeso(Math.abs(row.netCash))}
              </span>
            </div>
          </div>
        );
      })}

      <Separator />

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Reconciliation
        </div>

        {transfers.length === 0 ? (
          <p className="py-1.5 text-sm text-muted-foreground">No transfers needed.</p>
        ) : (
          transfers.map((t, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 text-sm">
              <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-destructive" />
              <span className="text-muted-foreground">
                Transfer <span className="font-mono font-semibold text-foreground">{formatPeso(t.amount)}</span>{" "}
                from <span className="text-foreground">{t.from}</span> → <span className="text-foreground">{t.to}</span>
              </span>
            </div>
          ))
        )}

        <div className="mt-2 rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Overall Net Cash</span>
          <span className={`font-mono text-base font-bold ${overall < 0 ? "text-destructive" : "text-foreground"}`}>
            {overall < 0 ? "-" : ""}{formatPeso(Math.abs(overall))}
          </span>
        </div>
      </div>
    </div>
  );
}
