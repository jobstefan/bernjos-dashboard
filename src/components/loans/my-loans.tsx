import { Landmark } from "lucide-react";
import { RequestLoanDialog } from "@/components/loans/request-loan-dialog";
import { LoansTable } from "@/components/loans/loans-table";
import { EmptyState } from "@/components/payroll/empty-state";
import { formatPeso } from "@/lib/utils/payroll";
import type { LoanRow } from "@/lib/types/loan";

export function MyLoans({
  loans,
  availableToBorrow,
}: {
  loans: LoanRow[];
  availableToBorrow: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">My Loans</h2>
          <p className="text-sm text-muted-foreground">
            Available to borrow:{" "}
            <span className="font-mono font-medium">{formatPeso(availableToBorrow)}</span>
          </p>
        </div>
        <RequestLoanDialog availableToBorrow={availableToBorrow} />
      </div>

      {loans.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No loan history"
          description="Request a loan against your savings balance. Repayments are deducted automatically from your payroll."
          action={<RequestLoanDialog availableToBorrow={availableToBorrow} />}
        />
      ) : (
        <LoansTable rows={loans} mode="mine" />
      )}
    </div>
  );
}
