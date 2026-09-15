"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { NumberStepper } from "@/components/kiosk/number-stepper";
import { WastageDialog } from "@/components/kiosk/wastage-dialog";
import { logRestockAction } from "@/app/actions/inventory.actions";
import { QUEUE_EVENT, allQueued, enqueueEntry } from "@/lib/kiosk/offline-queue";
import { formatPeso } from "@/lib/utils/payroll";
import type { KioskProduct, KioskState } from "@/lib/types/inventory";

const QUICK_ADDS = [1, 5, 10];

export function CountingTab({
  sessionId,
  state,
}: {
  sessionId: string;
  state: KioskState;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [productType, setProductType] = React.useState<"sale" | "production">("sale");
  const [categoryId, setCategoryId] = React.useState<string>("all");
  const [wasteFor, setWasteFor] = React.useState<KioskProduct | null>(null);
  const [customFor, setCustomFor] = React.useState<KioskProduct | null>(null);
  const [customQty, setCustomQty] = React.useState(1);
  // Optimistic on-hand adjustments from entries queued offline for this session.
  const [deltas, setDeltas] = React.useState<Record<string, number>>({});

  const loadDeltas = React.useCallback(async () => {
    const queued = await allQueued();
    const map: Record<string, number> = {};
    for (const e of queued) {
      if (e.sessionId !== sessionId) continue;
      map[e.productId] = (map[e.productId] ?? 0) + (e.type === "restock" ? e.quantity : -e.quantity);
    }
    setDeltas(map);
  }, [sessionId]);

  React.useEffect(() => {
    void loadDeltas();
    window.addEventListener(QUEUE_EVENT, loadDeltas);
    return () => window.removeEventListener(QUEUE_EVENT, loadDeltas);
  }, [loadDeltas]);

  const categoriesForType = React.useMemo(() => {
    const ids = new Set(state.products.filter((p) => p.type === productType).map((p) => p.categoryId));
    return state.categories.filter((c) => ids.has(c.id));
  }, [state.products, state.categories, productType]);

  const visible = React.useMemo(
    () =>
      state.products.filter(
        (p) => p.type === productType && (categoryId === "all" || p.categoryId === categoryId),
      ),
    [state.products, productType, categoryId],
  );

  function restock(product: KioskProduct, quantity: number) {
    startTransition(async () => {
      // Offline: queue locally and optimistically bump on-hand (§6).
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueEntry({ sessionId, productId: product.id, type: "restock", quantity });
        toast.success(`Saved offline · +${quantity} ${product.unit} ${product.name}`);
        return;
      }
      const res = await logRestockAction({ sessionId, productId: product.id, quantity });
      if (res.success) {
        toast.success(`+${quantity} ${product.unit} · ${product.name}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function switchType(next: "sale" | "production") {
    setProductType(next);
    setCategoryId("all");
  }

  return (
    <div className="space-y-4">
      {/* Sale / Production top-level switch (§5.0/5.3) */}
      <div className="flex gap-2">
        {(["sale", "production"] as const).map((t) => (
          <Button
            key={t}
            variant={productType === t ? "default" : "outline"}
            className="h-12 flex-1 text-base"
            onClick={() => switchType(t)}
          >
            {t === "sale" ? "Sale Items" : "Production Items"}
          </Button>
        ))}
      </div>

      {/* Category filter chips */}
      <div className="flex flex-wrap gap-2">
        <Chip active={categoryId === "all"} onClick={() => setCategoryId("all")}>
          All
        </Chip>
        {categoriesForType.map((c) => (
          <Chip key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
            {c.name}
          </Chip>
        ))}
      </div>

      {/* Product grid */}
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          No {productType === "sale" ? "sale" : "production"} items in this category.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const onHand = p.onHand + (deltas[p.id] ?? 0);
            const lowStock = p.reorderThreshold != null && onHand < p.reorderThreshold;
            return (
            <div
              key={p.id}
              className={cn(
                "rounded-xl border bg-card p-4",
                lowStock ? "border-destructive/50" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground">per {p.unit}</div>
                </div>
                {lowStock ? <Badge variant="destructive">Low</Badge> : null}
              </div>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold tabular-nums">{onHand}</span>
                <span className="text-sm text-muted-foreground">
                  {p.unit} on hand
                  {p.reorderThreshold != null ? ` · par ${p.reorderThreshold}` : ""}
                </span>
              </div>
              <div className="mt-0.5 text-sm text-muted-foreground">
                {p.price != null ? `${formatPeso(p.price)} / ${p.unit}` : "No price (production)"}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  className="h-12 text-base"
                  disabled={pending}
                  onClick={() => {
                    setCustomFor(p);
                    setCustomQty(1);
                  }}
                >
                  <Plus className="size-5" /> Add
                </Button>
                <Button
                  variant="outline"
                  className="h-12 text-base text-destructive"
                  disabled={pending}
                  onClick={() => setWasteFor(p)}
                >
                  <Trash2 className="size-5" /> Wastage
                </Button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      <WastageDialog
        sessionId={sessionId}
        product={wasteFor}
        open={wasteFor !== null}
        onOpenChange={(o) => !o && setWasteFor(null)}
      />

      {/* Add stock — quick amounts + custom stepper (§5.2 thumb-friendly) */}
      <Dialog open={customFor !== null} onOpenChange={(o) => !o && setCustomFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add stock</DialogTitle>
            <DialogDescription>
              {customFor ? `${customFor.name} · ${customFor.onHand + (deltas[customFor.id] ?? 0)} ${customFor.unit} on hand` : ""}
            </DialogDescription>
          </DialogHeader>

          {/* One-tap quick amounts */}
          <div className="grid grid-cols-3 gap-2 py-2">
            {QUICK_ADDS.map((n) => (
              <Button
                key={n}
                variant="outline"
                className="h-14 text-lg"
                disabled={pending}
                onClick={() => {
                  if (customFor) restock(customFor, n);
                  setCustomFor(null);
                }}
              >
                +{n}
              </Button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="flex flex-col items-center gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Custom amount</span>
            <NumberStepper value={customQty} onChange={setCustomQty} min={1} />
          </div>

          <DialogFooter>
            <Button
              className="h-12 w-full text-base"
              disabled={pending || customQty < 1}
              onClick={() => {
                if (customFor) restock(customFor, customQty);
                setCustomFor(null);
              }}
            >
              Add {customQty} {customFor?.unit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
