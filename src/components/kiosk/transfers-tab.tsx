"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { NumberStepper } from "@/components/kiosk/number-stepper";
import {
  cancelTransferAction,
  prepareTransferAction,
  receiveTransferAction,
  requestTransferAction,
} from "@/app/actions/stock-transfer.actions";
import type { KioskProduct, TransferRow } from "@/lib/types/inventory";

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  approved: "Approved",
  prepared: "Prepared",
  received: "Received",
  declined: "Declined",
  cancelled: "Cancelled",
};

export function TransfersTab({
  branchId,
  transfers,
  branches,
  products,
}: {
  branchId: string;
  transfers: TransferRow[];
  branches: { id: string; name: string }[];
  products: KioskProduct[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [requesting, setRequesting] = React.useState(false);
  const [fulfil, setFulfil] = React.useState<{ transfer: TransferRow; mode: "prepare" | "receive" } | null>(null);

  const toPrepare = transfers.filter((t) => t.status === "approved" && t.sourceBranchId === branchId);
  const toReceive = transfers.filter((t) => t.status === "prepared" && t.destBranchId === branchId);
  const myRequests = transfers.filter((t) => t.destBranchId === branchId);

  function cancel(id: string) {
    startTransition(async () => {
      const res = await cancelTransferAction(id);
      if (res.success) {
        toast.success("Request cancelled.");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex justify-end">
        <Button className="h-11" onClick={() => setRequesting(true)}>
          <Plus className="size-4" /> Request stock
        </Button>
      </div>

      <Section title={`To prepare & hand off (${toPrepare.length})`} empty="No approved requests waiting on your branch.">
        {toPrepare.map((t) => (
          <TransferCard key={t.id} transfer={t} subtitle={`For ${t.destBranchName}`}>
            <Button size="sm" disabled={pending} onClick={() => setFulfil({ transfer: t, mode: "prepare" })}>
              Prepare
            </Button>
          </TransferCard>
        ))}
      </Section>

      <Section title={`To receive & recount (${toReceive.length})`} empty="Nothing prepared and heading your way.">
        {toReceive.map((t) => (
          <TransferCard key={t.id} transfer={t} subtitle={`From ${t.sourceBranchName}`}>
            <Button size="sm" disabled={pending} onClick={() => setFulfil({ transfer: t, mode: "receive" })}>
              Receive
            </Button>
          </TransferCard>
        ))}
      </Section>

      <Section title={`My requests (${myRequests.length})`} empty="You haven't requested any stock yet.">
        {myRequests.map((t) => (
          <TransferCard key={t.id} transfer={t} subtitle={`From ${t.sourceBranchName}`}>
            <Badge variant="secondary">{STATUS_LABEL[t.status]}</Badge>
            {t.status === "requested" ? (
              <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => cancel(t.id)}>
                Cancel
              </Button>
            ) : null}
          </TransferCard>
        ))}
      </Section>

      <RequestDialog
        open={requesting}
        onOpenChange={setRequesting}
        branches={branches}
        products={products}
      />
      <FulfilDialog
        fulfil={fulfil}
        onOpenChange={(o) => !o && setFulfil(null)}
      />
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-muted-foreground">{title}</h3>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  );
}

function TransferCard({
  transfer,
  subtitle,
  children,
}: {
  transfer: TransferRow;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <ArrowLeftRight className="size-4 text-muted-foreground" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{subtitle}</div>
          <div className="text-xs text-muted-foreground">
            {transfer.lines.length} item{transfer.lines.length === 1 ? "" : "s"}
            {transfer.hasUnresolvedDiscrepancy ? " · discrepancy" : ""}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-7 text-xs text-muted-foreground">
        {transfer.lines.map((l) => (
          <span key={l.id}>
            {l.productName}: {l.receivedQty ?? l.preparedQty ?? l.requestedQty} {l.unit}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Request dialog ──────────────────────────────────────────────────────────

function RequestDialog({
  open,
  onOpenChange,
  branches,
  products,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  branches: { id: string; name: string }[];
  products: KioskProduct[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [sourceBranchId, setSourceBranchId] = React.useState("");
  const [lines, setLines] = React.useState<{ productId: string; qty: string }[]>([]);
  const [addProductId, setAddProductId] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setSourceBranchId("");
      setLines([]);
      setAddProductId("");
    }
  }, [open]);

  function addLine() {
    if (!addProductId || lines.some((l) => l.productId === addProductId)) return;
    setLines((ls) => [...ls, { productId: addProductId, qty: "1" }]);
    setAddProductId("");
  }

  function submit() {
    startTransition(async () => {
      const res = await requestTransferAction({
        sourceBranchId,
        lines: lines.map((l) => ({ productId: l.productId, requestedQty: Number(l.qty) })),
      });
      if (res.success) {
        toast.success("Request submitted.");
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;
  const available = products.filter((p) => !lines.some((l) => l.productId === p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request stock</DialogTitle>
          <DialogDescription>Ask another branch to send you products.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <label className="text-sm font-medium">From branch</label>
            <Select value={sourceBranchId} onValueChange={(v) => setSourceBranchId(v ?? "")}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Pick a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Products</label>
            {lines.map((l, i) => (
              <div key={l.productId} className="flex items-center gap-2">
                <span className="flex-1 truncate text-sm">{productName(l.productId)}</span>
                <Input
                  type="number"
                  min="1"
                  value={l.qty}
                  onChange={(e) =>
                    setLines((ls) => ls.map((x, xi) => (xi === i ? { ...x, qty: e.target.value } : x)))
                  }
                  className="h-11 w-20 text-center"
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove"
                  onClick={() => setLines((ls) => ls.filter((_, xi) => xi !== i))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Select value={addProductId} onValueChange={(v) => setAddProductId(v ?? "")}>
                <SelectTrigger className="h-11 flex-1">
                  <SelectValue placeholder="Add a product…" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={addLine} disabled={!addProductId}>
                <Plus className="size-4" /> Add
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            className="h-11 w-full"
            disabled={pending || !sourceBranchId || lines.length === 0}
            onClick={submit}
          >
            {pending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Prepare / receive dialog (per-line quantities) ──────────────────────────

function FulfilDialog({
  fulfil,
  onOpenChange,
}: {
  fulfil: { transfer: TransferRow; mode: "prepare" | "receive" } | null;
  onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [qty, setQty] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (fulfil) {
      const seed = fulfil.mode === "prepare"
        ? Object.fromEntries(fulfil.transfer.lines.map((l) => [l.id, String(l.requestedQty)]))
        : Object.fromEntries(fulfil.transfer.lines.map((l) => [l.id, String(l.preparedQty ?? 0)]));
      setQty(seed);
    }
  }, [fulfil]);

  if (!fulfil) return null;
  const { transfer, mode } = fulfil;

  function submit() {
    const lines = transfer.lines.map((l) => ({
      lineId: l.id,
      ...(mode === "prepare" ? { preparedQty: Number(qty[l.id] ?? 0) } : { receivedQty: Number(qty[l.id] ?? 0) }),
    }));
    startTransition(async () => {
      const res =
        mode === "prepare"
          ? await prepareTransferAction({ transferId: transfer.id, lines })
          : await receiveTransferAction({ transferId: transfer.id, lines });
      if (res.success) {
        toast.success(mode === "prepare" ? "Prepared and handed off." : "Received.");
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "prepare" ? "Prepare transfer" : "Receive transfer"}</DialogTitle>
          <DialogDescription>
            {mode === "prepare"
              ? `Enter what you're actually handing to ${transfer.destBranchName}.`
              : `Recount what actually arrived from ${transfer.sourceBranchName}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-1 overflow-y-auto py-2">
          {transfer.lines.map((l) => (
            <div key={l.id} className="flex items-center gap-3 rounded-lg px-2 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{l.productName}</div>
                <div className="text-xs text-muted-foreground">
                  {mode === "prepare"
                    ? `requested ${l.requestedQty} ${l.unit}`
                    : `prepared ${l.preparedQty ?? 0} ${l.unit}`}
                </div>
              </div>
              <NumberStepper
                className="ml-auto"
                value={Number(qty[l.id] ?? 0)}
                onChange={(n) => setQty((q) => ({ ...q, [l.id]: String(n) }))}
                min={0}
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button className="h-12 w-full text-base" disabled={pending} onClick={submit}>
            {pending ? "Saving…" : mode === "prepare" ? "Prepare & hand off" : "Confirm received"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
