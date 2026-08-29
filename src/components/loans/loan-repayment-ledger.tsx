"use client";

import { formatPeso } from "@/lib/utils/payroll";
import { toneClass } from "@/lib/utils/tone";
import type { LoanRepaymentRow } from "@/lib/types/loan";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function LoanRepaymentLedger({
  repayments,
  termPeriods,
}: {
  repayments: LoanRepaymentRow[];
  termPeriods: number;
}) {
  if (repayments.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Repayment schedule will appear once the loan is disbursed.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="hidden grid-cols-[3rem_1fr_1fr_6rem] gap-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
        <span>#</span>
        <span>Amount</span>
        <span>Period</span>
        <span className="text-right">Status</span>
      </div>
      {repayments.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-[3rem_1fr_1fr_6rem] items-center gap-2 rounded-lg border px-2 py-2 text-sm"
        >
          <span className="text-muted-foreground">{r.installmentNo}/{termPeriods}</span>
          <span className="font-mono">{formatPeso(r.amount)}</span>
          <span className="text-muted-foreground">
            {r.appliedPeriodLabel ?? (r.status === "pending" ? "Pending" : "—")}
          </span>
          <span className="text-right">
            <span
              className={
                "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " +
                toneClass(r.status === "applied" ? "success" : "neutral")
              }
            >
              {r.status}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
