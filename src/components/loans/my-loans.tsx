import { Landmark } from "lucide-react";
import { RequestLoanDialog } from "@/components/loans/request-loan-dialog";
import { LoansTable } from "@/components/loans/loans-table";
import { EmptyState } from "@/components/payroll/empty-state";
import { formatPeso } from "@/lib/utils/payroll";
import type { LoanRow } from "@/lib/types/loan";

export function MyLoans({
  loans,
  availableToBorrow,
  branches,
}: {
  loans: LoanRow[];
  availableToBorrow: number;
  branches: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Available to borrow:{" "}
        <span className="font-mono font-medium">{formatPeso(availableToBorrow)}</span>
      </p>

      {loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loan history"
          description="Request a loan against your savings balance. Repayments are deducted automatically from your payroll."
          action={<RequestLoanDialog availableToBorrow={availableToBorrow} branches={branches} />}
        />
      ) : (
        <LoansTable rows={loans} mode="mine" />
      )}
    </div>
  );
}
