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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NumberStepper } from "@/components/kiosk/number-stepper";
import { logWastageAction } from "@/app/actions/inventory.actions";
import { enqueueEntry } from "@/lib/kiosk/offline-queue";
import type { KioskProduct } from "@/lib/types/inventory";

type WastageReason = "expired" | "damaged" | "given_away" | "other";

const REASONS: { value: WastageReason; label: string }[] = [
  { value: "expired", label: "Expired" },
  { value: "damaged", label: "Damaged" },
  { value: "given_away", label: "Given away" },
  { value: "other", label: "Other" },
];

export function WastageDialog({
  sessionId,
  product,
  open,
  onOpenChange,
}: {
  sessionId: string;
  product: KioskProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [quantity, setQuantity] = React.useState(1);
  const [reason, setReason] = React.useState<WastageReason>("expired");
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setQuantity(1);
      setReason("expired");
      setNote("");
    }
  }, [open]);

  function submit() {
    if (!product || quantity < 1) return;
    const wasteNote = reason === "other" ? note : null;
    startTransition(async () => {
      // Offline: queue locally; the counting screen reflects it optimistically (§6).
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueEntry({
          sessionId,
          productId: product.id,
          type: "wastage",
          quantity,
          reason,
          note: wasteNote,
        });
        toast.success(`Saved offline · ${quantity} ${product.unit} wasted.`);
        onOpenChange(false);
        return;
      }
      const res = await logWastageAction({
        sessionId,
        productId: product.id,
        quantity,
        reason,
        note: wasteNote,
      });
      if (res.success) {
        toast.success(`Logged ${quantity} ${product.unit} wasted.`);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log wastage</DialogTitle>
          <DialogDescription>{product ? product.name : ""}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Quantity</Label>
            <NumberStepper value={quantity} onChange={setQuantity} min={1} />
          </div>
          <div className="grid gap-2">
            <Label>Reason</Label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <Button
                  key={r.value}
                  type="button"
                  variant={reason === r.value ? "default" : "outline"}
                  className="h-12 text-base"
                  onClick={() => setReason(r.value)}
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>
          {reason === "other" ? (
            <div className="grid gap-2">
              <Label>Note</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What happened?"
                rows={2}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={submit}
            disabled={pending || quantity < 1}
          >
            {pending ? "Saving…" : "Log wastage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
