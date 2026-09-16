"use client";

import * as React from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberStepper } from "@/components/kiosk/number-stepper";
import { closeSessionAction } from "@/app/actions/inventory.actions";
import { devLogoutAction } from "@/app/actions/dev-auth.actions";
import type { KioskProduct } from "@/lib/types/inventory";

export function CloseSessionPage({
  sessionId,
  products,
  branchName,
  dateLabel,
  devAuth,
}: {
  sessionId: string;
  products: KioskProduct[];
  branchName: string;
  dateLabel: string;
  devAuth: boolean;
}) {
  const { signOut } = useClerk();
  const [pending, startTransition] = React.useTransition();
  const [counts, setCounts] = React.useState<Record<string, number>>(
    () => Object.fromEntries(products.map((p) => [p.id, p.onHand])),
  );

  function submit() {
    startTransition(async () => {
      const res = await closeSessionAction({
        sessionId,
        counts: products.map((p) => ({ productId: p.id, quantity: counts[p.id] ?? p.onHand })),
      });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      toast.success("Session closed.");
      if (devAuth) {
        await devLogoutAction();
      } else {
        await signOut({ redirectUrl: "/sign-in" });
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <Link
          href="/kiosk"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">Close session</div>
          <div className="text-xs text-muted-foreground">
            {branchName} · {dateLabel}
          </div>
        </div>
      </header>

      {/* Description */}
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Enter the physical closing count for each product. Sold / consumed quantities are derived
          from these. This locks the session.
        </p>
      </div>

      {/* Product list */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {products.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-muted-foreground">No products to count.</p>
        ) : (
          products.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  on-hand {p.onHand} {p.unit}
                </div>
              </div>
              <NumberStepper
                value={counts[p.id] ?? p.onHand}
                onChange={(n) => setCounts((c) => ({ ...c, [p.id]: n }))}
                min={0}
              />
            </div>
          ))
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 flex gap-3 border-t border-border bg-background px-4 py-3">
        <Link
          href="/kiosk"
          className="flex h-14 flex-1 items-center justify-center rounded-md text-base font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-disabled={pending}
        >
          Cancel
        </Link>
        <Button
          className="h-14 flex-[2] text-base"
          onClick={submit}
          disabled={pending || products.length === 0}
        >
          {pending ? "Closing…" : "Confirm close"}
        </Button>
      </div>
    </div>
  );
}
