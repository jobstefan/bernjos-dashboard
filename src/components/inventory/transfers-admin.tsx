"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { TransferSlip } from "@/components/inventory/transfer-slip";
import { toneClass } from "@/lib/utils/tone";
import {
  approveTransferAction,
  declineTransferAction,
  resolveDiscrepancyAction,
} from "@/app/actions/stock-transfer.actions";
import type { BstStatus, BstDiscrepancy } from "@/generated/prisma/enums";
import type { TransferRow } from "@/lib/types/inventory";
import type { Tone } from "@/lib/utils/tone";

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

const RESOLUTIONS: { value: BstDiscrepancy; label: string }[] = [
  { value: "sender_wastage", label: "Sender-side wastage" },
  { value: "receiver_wastage", label: "Receiver-side wastage" },
  { value: "variance_note", label: "Record as a variance note" },
];

export function TransfersAdmin({
  transfers,
  canResolve,
}: {
  transfers: TransferRow[];
  canResolve: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<TransferRow | null>(null);
  const [resolving, setResolving] = React.useState<TransferRow | null>(null);

  function act(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(ok);
        setSelected(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  if (transfers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        No transfer slips yet.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {transfers.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t)}
            className="w-full rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex flex-wrap items-center gap-3">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              {t.slipNumber ? (
                <span className="font-mono text-sm font-medium">{t.slipNumber}</span>
              ) : null}
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                {t.sourceBranchName}
                <ArrowRight className="size-3.5" />
                {t.destBranchName}
              </div>
              <span
                className={
                  "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " +
                  toneClass(bstStatusTone(t.status))
                }
              >
                {BST_STATUS_LABEL[t.status]}
              </span>
              {t.hasUnresolvedDiscrepancy ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  <AlertTriangle className="size-3" /> discrepancy
                </span>
              ) : null}
            </div>

            <div className="mt-3 grid gap-1 border-t border-border pt-3 text-sm">
              {t.lines.map((l) => {
                const mismatch = l.preparedQty !== null && l.receivedQty !== l.preparedQty;
                return (
                  <div key={l.id} className="flex items-center gap-3 text-muted-foreground">
                    <span className="flex-1">{l.productName}</span>
                    <span>req {l.requestedQty}</span>
                    <span>prep {l.preparedQty ?? "—"}</span>
                    <span className={mismatch ? "font-medium text-destructive" : ""}>
                      recv {l.receivedQty ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </button>
        ))}
      </div>

      {/* Slip detail drawer */}
      <DetailDrawer
        open={selected !== null}
        onOpenChange={(o) => !o && setSelected(null)}
        title={selected?.slipNumber ?? "Transfer slip"}
        description={
          selected
            ? `${selected.sourceBranchName} → ${selected.destBranchName}`
            : undefined
        }
        footer={
          selected ? (
            <div className="flex flex-col gap-2">
              {selected.status === "requested" ? (
                <div className="flex gap-2">
                  <Button
                    className="h-11 flex-1"
                    disabled={pending}
                    onClick={() =>
                      act(() => approveTransferAction(selected.id), "Transfer slip approved.")
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 flex-1 text-destructive"
                    disabled={pending}
                    onClick={() =>
                      act(() => declineTransferAction(selected.id), "Transfer slip declined.")
                    }
                  >
                    Decline
                  </Button>
                </div>
              ) : null}
              {canResolve && selected.hasUnresolvedDiscrepancy ? (
                <Button
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => {
                    setResolving(selected);
                    setSelected(null);
                  }}
                >
                  Resolve discrepancy
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {selected ? <TransferSlip transfer={selected} showPrint /> : null}
      </DetailDrawer>

      <ResolveDialog transfer={resolving} onOpenChange={(o) => !o && setResolving(null)} />
    </>
  );
}

function ResolveDialog({
  transfer,
  onOpenChange,
}: {
  transfer: TransferRow | null;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [resolution, setResolution] = React.useState<BstDiscrepancy>("variance_note");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (transfer) {
      setResolution("variance_note");
      setNote("");
    }
  }, [transfer]);

  if (!transfer) return null;

  function submit() {
    startTransition(async () => {
      const res = await resolveDiscrepancyAction({ transferId: transfer!.id, resolution, note });
      if (res.success) {
        toast.success("Discrepancy resolved.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolve discrepancy</DialogTitle>
          <DialogDescription>
            {transfer.slipNumber ? (
              <span className="font-mono">{transfer.slipNumber} · </span>
            ) : null}
            Decide how to book the difference between prepared and received quantities.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Select value={resolution} onValueChange={(v) => setResolution((v as BstDiscrepancy) ?? "variance_note")}>
            <SelectTrigger className="w-full">
              <SelectValue>{RESOLUTIONS.find((r) => r.value === resolution)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (what happened, how it was booked)…"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button className="w-full" disabled={pending} onClick={submit}>
            {pending ? "Saving…" : "Save resolution"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
