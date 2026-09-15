"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import {
  approveTransferAction,
  declineTransferAction,
  resolveDiscrepancyAction,
} from "@/app/actions/stock-transfer.actions";
import type { BstStatus, BstDiscrepancy } from "@/generated/prisma/enums";
import type { TransferRow } from "@/lib/types/inventory";

const STATUS_VARIANT: Record<BstStatus, "default" | "secondary" | "outline" | "destructive"> = {
  requested: "outline",
  approved: "default",
  prepared: "secondary",
  received: "secondary",
  declined: "destructive",
  cancelled: "outline",
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
  const [resolving, setResolving] = React.useState<TransferRow | null>(null);

  function act(fn: () => Promise<{ success: boolean; error?: string }>, ok: string) {
    startTransition(async () => {
      const res = await fn();
      if (res.success) {
        toast.success(ok);
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  if (transfers.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        No stock transfers yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {transfers.map((t) => (
        <div key={t.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-medium">
              {t.sourceBranchName}
              <ArrowRight className="size-4 text-muted-foreground" />
              {t.destBranchName}
            </div>
            <Badge variant={STATUS_VARIANT[t.status]}>{t.status}</Badge>
            {t.hasUnresolvedDiscrepancy ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3.5" /> discrepancy
              </Badge>
            ) : null}
            {t.discrepancyResolution ? (
              <span className="text-xs text-muted-foreground">
                resolved: {t.discrepancyResolution.replace("_", " ")}
              </span>
            ) : null}

            <div className="ml-auto flex items-center gap-2">
              {t.status === "requested" ? (
                <>
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => act(() => approveTransferAction(t.id), "Approved.")}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() => act(() => declineTransferAction(t.id), "Declined.")}
                  >
                    Decline
                  </Button>
                </>
              ) : null}
              {canResolve && t.hasUnresolvedDiscrepancy ? (
                <Button size="sm" variant="outline" onClick={() => setResolving(t)}>
                  Resolve
                </Button>
              ) : null}
            </div>
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
        </div>
      ))}

      <ResolveDialog transfer={resolving} onOpenChange={(o) => !o && setResolving(null)} />
    </div>
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
