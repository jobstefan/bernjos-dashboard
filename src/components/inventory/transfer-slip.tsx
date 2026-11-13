import { ArrowRight, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/payroll";
import { toneClass } from "@/lib/utils/tone";
import type { Tone } from "@/lib/utils/tone";
import type { BstStatus } from "@/generated/prisma/enums";
import type { TransferRow } from "@/lib/types/inventory";

function bstStatusTone(status: BstStatus): Tone {
  switch (status) {
    case "requested": return "neutral";
    case "approved":  return "info";
    case "prepared":  return "warning";
    case "received":  return "success";
    case "declined":  return "danger";
    case "cancelled": return "neutral";
  }
}

const BST_STATUS_LABEL: Record<BstStatus, string> = {
  requested: "Requested",
  approved:  "Approved",
  prepared:  "Prepared",
  received:  "Received",
  declined:  "Declined",
  cancelled: "Cancelled",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function sum(ns: (number | null)[]): number | null {
  const present = ns.filter((n): n is number => n !== null);
  return present.length ? present.reduce((a, b) => a + b, 0) : null;
}

export function TransferSlip({
  transfer,
  showPrint = false,
}: {
  transfer: TransferRow;
  showPrint?: boolean;
}) {
  const hasDiscrepancy = transfer.lines.some(
    (l) => l.preparedQty !== null && l.receivedQty !== null && l.receivedQty !== l.preparedQty,
  );
  const totalReq = sum(transfer.lines.map((l) => l.requestedQty));
  const totalPrep = sum(transfer.lines.map((l) => l.preparedQty));
  const totalRecv = sum(transfer.lines.map((l) => l.receivedQty));

  return (
    <div className="print-slip overflow-hidden rounded-xl border border-border bg-card">
      {/* Letterhead */}
      <div className="border-b border-dashed border-border bg-muted/40 px-5 py-4 text-center">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Stock Transfer Slip
        </div>
        {transfer.slipNumber ? (
          <div className="mt-1 font-mono text-lg font-bold tracking-tight">{transfer.slipNumber}</div>
        ) : null}
        <div className="mt-2 flex items-center justify-center">
          <span
            className={
              "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium " +
              toneClass(bstStatusTone(transfer.status))
            }
          >
            {BST_STATUS_LABEL[transfer.status]}
          </span>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {/* From → To */}
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">From</div>
            <div className="truncate text-sm font-medium">{transfer.sourceBranchName}</div>
            {transfer.sourceBranchCode ? (
              <div className="font-mono text-xs text-muted-foreground">{transfer.sourceBranchCode}</div>
            ) : null}
          </div>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">To</div>
            <div className="truncate text-sm font-medium">{transfer.destBranchName}</div>
            {transfer.destBranchCode ? (
              <div className="font-mono text-xs text-muted-foreground">{transfer.destBranchCode}</div>
            ) : null}
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Items
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dashed border-border text-xs text-muted-foreground">
                <th className="py-1 text-left font-medium">Product</th>
                <th className="py-1 text-right font-medium">Req</th>
                <th className="py-1 text-right font-medium">Prep</th>
                <th className="py-1 text-right font-medium">Recv</th>
              </tr>
            </thead>
            <tbody>
              {transfer.lines.map((l) => {
                const mismatch =
                  l.preparedQty !== null &&
                  l.receivedQty !== null &&
                  l.receivedQty !== l.preparedQty;
                return (
                  <tr key={l.id} className="border-b border-border/60 last:border-0">
                    <td className="py-1.5 pr-2">
                      <span className="font-medium">{l.productName}</span>
                      <span className="ml-1 text-xs text-muted-foreground">{l.unit}</span>
                    </td>
                    <td className="py-1.5 text-right font-mono text-xs">{l.requestedQty}</td>
                    <td className="py-1.5 text-right font-mono text-xs">{l.preparedQty ?? "—"}</td>
                    <td
                      className={
                        "py-1.5 text-right font-mono text-xs " +
                        (mismatch ? "font-semibold text-destructive" : "")
                      }
                    >
                      {l.receivedQty ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-dashed border-border font-medium">
                <td className="py-1.5 text-xs uppercase tracking-wide text-muted-foreground">Total</td>
                <td className="py-1.5 text-right font-mono text-xs">{totalReq ?? "—"}</td>
                <td className="py-1.5 text-right font-mono text-xs">{totalPrep ?? "—"}</td>
                <td className="py-1.5 text-right font-mono text-xs">{totalRecv ?? "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Timeline */}
        <div className="border-t border-dashed border-border pt-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline
          </div>
          <Field label="Requested" value={formatDate(transfer.requestedAt)} />
          {transfer.approvedAt ? <Field label="Approved" value={formatDate(transfer.approvedAt)} /> : null}
          {transfer.preparedAt ? <Field label="Prepared" value={formatDate(transfer.preparedAt)} /> : null}
          {transfer.receivedAt ? <Field label="Received" value={formatDate(transfer.receivedAt)} /> : null}
          {transfer.decisionNote ? (
            <div className="py-1.5">
              <p className="mb-0.5 text-sm text-muted-foreground">
                {transfer.status === "declined" ? "Decline reason" : "Note"}
              </p>
              <p className="text-sm">{transfer.decisionNote}</p>
            </div>
          ) : null}
        </div>

        {/* Discrepancy */}
        {hasDiscrepancy || transfer.discrepancyResolution ? (
          <div className="border-t border-dashed border-border pt-3">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Discrepancy
            </div>
            {transfer.discrepancyResolution ? (
              <Field label="Resolution" value={transfer.discrepancyResolution.replace(/_/g, " ")} />
            ) : (
              <p className="py-1 text-sm text-destructive">Unresolved — pending admin review.</p>
            )}
            {transfer.discrepancyNote ? (
              <div className="py-1.5">
                <p className="mb-0.5 text-sm text-muted-foreground">Note</p>
                <p className="text-sm">{transfer.discrepancyNote}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {showPrint ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full print:hidden"
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Print slip
          </Button>
        ) : null}
      </div>
    </div>
  );
}
