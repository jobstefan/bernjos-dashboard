"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, FileText, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { TransferSlip } from "@/components/inventory/transfer-slip";
import { toneClass } from "@/lib/utils/tone";
import {
  cancelTransferAction,
  prepareTransferAction,
  receiveTransferAction,
  requestTransferAction,
} from "@/app/actions/stock-transfer.actions";
import type { KioskProduct, TransferRow } from "@/lib/types/inventory";
import type { BstStatus } from "@/generated/prisma/enums";
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
  const [selected, setSelected] = React.useState<TransferRow | null>(null);
  const [fulfil, setFulfil] = React.useState<{ transfer: TransferRow; mode: "prepare" | "receive" } | null>(null);

  const toPrepare = transfers.filter((t) => t.status === "approved" && t.sourceBranchId === branchId);
  const toReceive = transfers.filter((t) => t.status === "prepared" && t.destBranchId === branchId);
  const myRequests = transfers.filter((t) => t.destBranchId === branchId);

  function cancel(id: string) {
    startTransition(async () => {
      const res = await cancelTransferAction(id);
      if (res.success) {
        toast.success("Request cancelled.");
        setSelected(null);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const selectedMode =
    selected &&
    (selected.status === "approved" && selected.sourceBranchId === branchId
      ? "prepare"
      : selected.status === "prepared" && selected.destBranchId === branchId
      ? "receive"
      : null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex justify-end">
        <Button className="h-11" onClick={() => setRequesting(true)}>
          <Plus className="size-4" /> Issue request slip
        </Button>
      </div>

      <Section title={`To prepare & hand off (${toPrepare.length})`} empty="No approved slips waiting on your branch.">
        {toPrepare.map((t) => (
          <SlipCard key={t.id} transfer={t} subtitle={`For ${t.destBranchName}`} onClick={() => setSelected(t)} />
        ))}
      </Section>

      <Section title={`To receive & verify (${toReceive.length})`} empty="Nothing prepared and heading your way.">
        {toReceive.map((t) => (
          <SlipCard key={t.id} transfer={t} subtitle={`From ${t.sourceBranchName}`} onClick={() => setSelected(t)} />
        ))}
      </Section>

      <Section title={`My request slips (${myRequests.length})`} empty="You haven't issued any request slips yet.">
        {myRequests.map((t) => (
          <SlipCard key={t.id} transfer={t} subtitle={`From ${t.sourceBranchName}`} onClick={() => setSelected(t)} />
        ))}
      </Section>

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
              {selectedMode === "prepare" ? (
                <Button
                  className="h-11 w-full"
                  disabled={pending}
                  onClick={() => {
                    setFulfil({ transfer: selected, mode: "prepare" });
                    setSelected(null);
                  }}
                >
                  Prepare & hand off
                </Button>
              ) : selectedMode === "receive" ? (
                <Button
                  className="h-11 w-full"
                  disabled={pending}
                  onClick={() => {
                    setFulfil({ transfer: selected, mode: "receive" });
                    setSelected(null);
                  }}
                >
                  Receive & verify
                </Button>
              ) : null}
              {selected.status === "requested" ? (
                <Button
                  variant="ghost"
                  className="h-11 w-full text-destructive"
                  disabled={pending}
                  onClick={() => cancel(selected.id)}
                >
                  Cancel slip
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      >
        {selected ? <TransferSlip transfer={selected} showPrint /> : null}
      </DetailDrawer>

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

function SlipCard({
  transfer,
  subtitle,
  onClick,
}: {
  transfer: TransferRow;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-border bg-card p-3 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex items-center gap-3">
        <FileText className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {transfer.slipNumber ? (
              <span className="font-mono text-xs font-medium text-muted-foreground">
                {transfer.slipNumber}
              </span>
            ) : null}
            <span className="truncate text-sm font-medium">{subtitle}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {transfer.lines.length} item{transfer.lines.length === 1 ? "" : "s"}
            </span>
            {transfer.hasUnresolvedDiscrepancy ? (
              <span className="text-destructive">· discrepancy</span>
            ) : null}
          </div>
        </div>
        <span
          className={
            "inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium " +
            toneClass(bstStatusTone(transfer.status))
          }
        >
          {BST_STATUS_LABEL[transfer.status]}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-7 text-xs text-muted-foreground">
        {transfer.lines.map((l) => (
          <span key={l.id}>
            {l.productName}: {l.receivedQty ?? l.preparedQty ?? l.requestedQty} {l.unit}
          </span>
        ))}
      </div>
    </button>
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
        toast.success("Request slip issued.");
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
          <DialogTitle>Issue request slip</DialogTitle>
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
            {pending ? "Issuing…" : "Issue slip"}
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
        toast.success(mode === "prepare" ? "Slip prepared and handed off." : "Slip received & verified.");
        onOpenChange(false);
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "prepare" ? "Prepare transfer slip" : "Receive & verify slip"}
          </DialogTitle>
          <DialogDescription>
            {transfer.slipNumber ? (
              <span className="font-mono">{transfer.slipNumber} · </span>
            ) : null}
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
            {pending
              ? "Saving…"
              : mode === "prepare"
              ? "Prepare & hand off"
              : "Confirm received"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
