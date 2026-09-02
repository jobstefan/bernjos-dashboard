import { AlertCircle, CheckCircle2, ArrowDown, ArrowUp } from "lucide-react";
import type { BranchCashRow } from "@/server/services/analytics.service";
import { formatPeso } from "@/lib/utils/payroll";
import { Separator } from "@/components/ui/separator";

export function BranchCashSummary({ rows }: { rows: BranchCashRow[] }) {
  const branches = rows
    .map((r) => ({
      branchId: r.branchId,
      branchName: r.branchName,
      total: Math.round(r.employees.reduce((s, e) => s + e.netCash, 0) * 100) / 100,
    }))
    .sort((a, b) => a.total - b.total);

  if (branches.length === 0) return null;

  const deficits = branches.filter((b) => b.total < 0);
  const surpluses = branches.filter((b) => b.total > 0);

  const totalDeficit = deficits.reduce((s, b) => s + Math.abs(b.total), 0);
  const totalSurplus = surpluses.reduce((s, b) => s + b.total, 0);
  const covered = totalSurplus >= totalDeficit;
  const remainder = Math.round((totalSurplus - totalDeficit) * 100) / 100;

  const contributions = surpluses.map((b) => ({
    branchName: b.branchName,
    amount:
      totalSurplus > 0
        ? Math.round((b.total / totalSurplus) * Math.min(totalDeficit, totalSurplus) * 100) / 100
        : 0,
  }));

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="text-sm font-semibold">Branch Cash Summary</div>

      <Separator />

      {/* Per-branch totals */}
      <div className="space-y-0.5">
        {branches.map((b) => (
          <div
            key={b.branchId ?? "__unassigned__"}
            className="flex items-center justify-between py-1.5 text-sm"
          >
            <span className="text-foreground">{b.branchName}</span>
            <span
              className={
                "font-mono font-medium " +
                (b.total < 0 ? "text-destructive" : b.total > 0 ? "text-emerald-600" : "text-muted-foreground")
              }
            >
              {b.total < 0 ? "-" : b.total > 0 ? "+" : ""}
              {formatPeso(Math.abs(b.total))}
            </span>
          </div>
        ))}
      </div>

      {deficits.length > 0 && (
        <>
          <Separator />

          {/* Cash needed per deficit branch */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cash to give
            </div>
            {deficits.map((b) => (
              <div
                key={b.branchId ?? "__unassigned__"}
                className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                <ArrowDown className="size-4 shrink-0" />
                <span>
                  Give{" "}
                  <span className="font-mono font-semibold">
                    {formatPeso(Math.abs(b.total))}
                  </span>{" "}
                  to <span className="font-semibold">{b.branchName}</span>
                </span>
              </div>
            ))}
          </div>

          {/* Coverage status */}
          <div
            className={
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm " +
              (covered
                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
                : "border border-destructive/30 bg-destructive/10 text-destructive")
            }
          >
            {covered ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            <span>
              {covered ? (
                <>
                  Covered —{" "}
                  <span className="font-mono font-semibold">
                    {formatPeso(totalSurplus)}
                  </span>{" "}
                  combined surplus
                  {remainder > 0 && (
                    <>
                      {" "}
                      ({" "}
                      <span className="font-mono">{formatPeso(remainder)}</span>{" "}
                      remaining after)
                    </>
                  )}
                </>
              ) : (
                <>
                  Shortfall —{" "}
                  <span className="font-mono font-semibold">
                    {formatPeso(Math.abs(remainder))}
                  </span>{" "}
                  short across all branches
                </>
              )}
            </span>
          </div>

          {/* Pull-from breakdown (only when there are surpluses) */}
          {contributions.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Pull from
              </div>
              {contributions.map((c) => (
                <div
                  key={c.branchName}
                  className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700"
                >
                  <ArrowUp className="size-4 shrink-0" />
                  <span>
                    Pull{" "}
                    <span className="font-mono font-semibold">
                      {formatPeso(c.amount)}
                    </span>{" "}
                    from <span className="font-semibold">{c.branchName}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
