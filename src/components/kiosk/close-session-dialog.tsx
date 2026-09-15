"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NumberStepper } from "@/components/kiosk/number-stepper";
import { closeSessionAction } from "@/app/actions/inventory.actions";
import type { KioskProduct } from "@/lib/types/inventory";

/**
 * End-of-day closing count. Prefilled with the system's current on-hand so the
 * operator only adjusts where the physical count differs. Closing is a
 * hard-to-undo action, so unlike restocks it is behind an explicit confirm (§5.2).
 */
export function CloseSessionDialog({
  sessionId,
  products,
  open,
  onOpenChange,
}: {
  sessionId: string;
  products: KioskProduct[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [counts, setCounts] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setCounts(Object.fromEntries(products.map((p) => [p.id, String(p.onHand)])));
    }
  }, [open, products]);

  function submit() {
    const parsed = products.map((p) => ({
      productId: p.id,
      quantity: Number(counts[p.id] ?? p.onHand),
    }));
    startTransition(async () => {
      const res = await closeSessionAction({ sessionId, counts: parsed });
      if (res.success) {
        toast.success("Session closed. Today's usage is now derived.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Close today&apos;s session</DialogTitle>
          <DialogDescription>
            Enter the physical closing count for each product. Sold / consumed quantities are
            derived from these. This locks the session.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-1 overflow-y-auto py-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  on-hand {p.onHand} {p.unit}
                </div>
              </div>
              <NumberStepper
                className="ml-auto"
                value={Number(counts[p.id] ?? p.onHand)}
                onChange={(n) => setCounts((c) => ({ ...c, [p.id]: String(n) }))}
                min={0}
              />
            </div>
          ))}
          {products.length === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">No products to count.</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={submit}
            disabled={pending || products.length === 0}
          >
            {pending ? "Closing…" : "Close session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
