import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import type { SavingsTransactionType, SavingsTransactionRow } from "@/lib/types/savings";

const TYPE_LABEL: Record<SavingsTransactionType, string> = {
  contribution: "Contribution",
  withdrawal: "Withdrawal",
  adjustment: "Adjustment",
};

/** Read-only savings ledger, shared by the self-service and admin history views. */
export function SavingsLedger({
  transactions,
  compact = false,
}: {
  transactions: SavingsTransactionRow[];
  /** Force card-only layout (e.g. when rendered inside a narrow drawer). */
  compact?: boolean;
}) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border py-8 text-center text-sm text-muted-foreground">
        No activity yet. Contributions appear here after each payroll run.
      </div>
    );
  }

  return (
    <>
      {/* Mobile: card stack (always shown when compact) */}
      <div className={compact ? "space-y-3" : "space-y-3 md:hidden"}>
        {[...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium">{TYPE_LABEL[t.type]}</div>
                <div className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</div>
              </div>
              <span
                className={
                  "font-mono text-sm font-semibold " +
                  (t.amount < 0 ? "text-destructive" : "text-foreground")
                }
              >
                {t.amount < 0 ? "-" : "+"}
                {formatPeso(Math.abs(t.amount))}
              </span>
            </div>
            {(t.appliedPeriodLabel || t.note) ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {t.appliedPeriodLabel ? (
                  <div>
                    <dt className="text-muted-foreground">Period</dt>
                    <dd>{t.appliedPeriodLabel}</dd>
                  </div>
                ) : null}
                {t.note ? (
                  <div>
                    <dt className="text-muted-foreground">Note</dt>
                    <dd>{t.note}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
          </div>
        ))}
      </div>

      {/* Desktop: table (hidden in compact/drawer mode) */}
      <div className={compact ? "hidden" : "hidden md:block w-full overflow-x-auto rounded-xl border"}>
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Date</TableHead>
              <TableHead className="w-28">Type</TableHead>
              <TableHead className="w-40">Period</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-36 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {formatDate(t.createdAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap">{TYPE_LABEL[t.type]}</TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {t.appliedPeriodLabel ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-0">
                  <span className="block truncate" title={t.note ?? undefined}>
                    {t.note ?? "—"}
                  </span>
                </TableCell>
                <TableCell
                  className={
                    "text-right font-mono whitespace-nowrap " +
                    (t.amount < 0 ? "text-destructive" : "text-foreground")
                  }
                >
                  {t.amount < 0 ? "-" : "+"}
                  {formatPeso(Math.abs(t.amount))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
