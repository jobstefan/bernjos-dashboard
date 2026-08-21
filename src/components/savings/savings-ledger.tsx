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
  return (
    <div className="overflow-x-auto rounded-xl border">
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
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-8 text-center text-sm text-muted-foreground"
              >
                No activity yet. Contributions appear here after each payroll run.
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((t) => (
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
