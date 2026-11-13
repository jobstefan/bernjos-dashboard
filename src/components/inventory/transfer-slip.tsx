import { ArrowRight, Printer } from "lucide-react";
import { Separator } from "@/components/ui/separator";
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </div>
      {children}
    </div>
  );
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

  return (
    <div className="space-y-4 print-slip">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            {transfer.slipNumber ? (
              <div className="font-mono text-base font-semibold">{transfer.slipNumber}</div>
            ) : null}
            <div className="mt-0.5 flex items-center gap-1.5 text-sm font-medium">
              {transfer.sourceBranchName}
              <ArrowRight className="size-3.5 text-muted-foreground" />
              {transfer.destBranchName}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Issued {formatDate(transfer.requestedAt)}
            </div>
          </div>
          <span
            className={
              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " +
              toneClass(bstStatusTone(transfer.status))
            }
          >
            {BST_STATUS_LABEL[transfer.status]}
          </span>
        </div>
      </div>

      <Separator />

      {/* Line items */}
      <Section heading="Items">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 text-sm">
          <div className="pb-1 text-xs font-medium text-muted-foreground">Product</div>
          <div className="pb-1 text-right text-xs font-medium text-muted-foreground">Req</div>
          <div className="pb-1 text-right text-xs font-medium text-muted-foreground">Prep</div>
          <div className="pb-1 text-right text-xs font-medium text-muted-foreground">Recv</div>
          {transfer.lines.map((l) => {
            const mismatch =
              l.preparedQty !== null &&
              l.receivedQty !== null &&
              l.receivedQty !== l.preparedQty;
            return (
              <>
                <div key={`${l.id}-name`} className="truncate py-1">
                  {l.productName}
                  <span className="ml-1 text-xs text-muted-foreground">{l.unit}</span>
                </div>
                <div key={`${l.id}-req`} className="py-1 text-right font-mono text-xs">
                  {l.requestedQty}
                </div>
                <div key={`${l.id}-prep`} className="py-1 text-right font-mono text-xs">
                  {l.preparedQty ?? "—"}
                </div>
                <div
                  key={`${l.id}-recv`}
                  className={
                    "py-1 text-right font-mono text-xs " +
                    (mismatch ? "font-semibold text-destructive" : "")
                  }
                >
                  {l.receivedQty ?? "—"}
                </div>
              </>
            );
          })}
        </div>
      </Section>

      <Separator />

      {/* Timeline */}
      <Section heading="Timeline">
        <Row label="Requested" value={formatDate(transfer.requestedAt)} />
        {transfer.approvedAt ? (
          <Row label="Approved" value={formatDate(transfer.approvedAt)} />
        ) : null}
        {transfer.preparedAt ? (
          <Row label="Prepared" value={formatDate(transfer.preparedAt)} />
        ) : null}
        {transfer.receivedAt ? (
          <Row label="Received" value={formatDate(transfer.receivedAt)} />
        ) : null}
        {transfer.decisionNote ? (
          <div className="py-1.5">
            <p className="mb-0.5 text-sm text-muted-foreground">
              {transfer.status === "declined" ? "Decline reason" : "Note"}
            </p>
            <p className="text-sm">{transfer.decisionNote}</p>
          </div>
        ) : null}
      </Section>

      {/* Discrepancy */}
      {(hasDiscrepancy || transfer.discrepancyResolution) ? (
        <>
          <Separator />
          <Section heading="Discrepancy">
            {transfer.discrepancyResolution ? (
              <Row
                label="Resolution"
                value={transfer.discrepancyResolution.replace(/_/g, " ")}
              />
            ) : (
              <p className="py-1 text-sm text-destructive">Unresolved — pending admin review.</p>
            )}
            {transfer.discrepancyNote ? (
              <div className="py-1.5">
                <p className="mb-0.5 text-sm text-muted-foreground">Note</p>
                <p className="text-sm">{transfer.discrepancyNote}</p>
              </div>
            ) : null}
          </Section>
        </>
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
  );
}
