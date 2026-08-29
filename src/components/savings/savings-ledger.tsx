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
}: {
  transactions: SavingsTransactionRow[];
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
      {/* Mobile: card stack */}
      <div className="space-y-3 md:hidden">
        {transactions.map((t) => (
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

      {/* Desktop: table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(t.createdAt)}
                </TableCell>
                <TableCell>{TYPE_LABEL[t.type]}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.appliedPeriodLabel ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.note ?? "—"}
                </TableCell>
                <TableCell
                  className={
                    "text-right font-mono " +
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
