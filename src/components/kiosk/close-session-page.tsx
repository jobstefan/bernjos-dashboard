"use client";

import * as React from "react";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronLeft, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NumberStepper } from "@/components/kiosk/number-stepper";
import { closeSessionAction } from "@/app/actions/inventory.actions";
import { devLogoutAction } from "@/app/actions/dev-auth.actions";
import type { EodSummary, KioskProduct } from "@/lib/types/inventory";

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
  const [summary, setSummary] = React.useState<EodSummary | null>(null);

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
      setSummary(res.data.summary);
    });
  }

  function handleSignOut() {
    startTransition(async () => {
      if (devAuth) {
        await devLogoutAction();
      } else {
        await signOut({ redirectUrl: "/sign-in" });
      }
    });
  }

  if (summary) {
    return (
      <EodSummaryScreen
        summary={summary}
        branchName={branchName}
        dateLabel={dateLabel}
        pending={pending}
        onSignOut={handleSignOut}
      />
    );
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

function EodSummaryScreen({
  summary,
  branchName,
  dateLabel,
  pending,
  onSignOut,
}: {
  summary: EodSummary;
  branchName: string;
  dateLabel: string;
  pending: boolean;
  onSignOut: () => void;
}) {
  const { products, totals } = summary;

  // Shortages first, then overages, then clean — alphabetical within each group.
  const sorted = [...products].sort((a, b) => {
    const rankA = a.variance > 0 ? 0 : a.variance < 0 ? 1 : 2;
    const rankB = b.variance > 0 ? 0 : b.variance < 0 ? 1 : 2;
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CheckCircle2 className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">Session closed</div>
          <div className="text-xs text-muted-foreground">
            {branchName} · {dateLabel}
          </div>
        </div>
      </header>

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 border-b border-border px-4 py-3">
        <div className="rounded-lg bg-muted px-3 py-2 text-center">
          <div className="text-xl font-bold">{totals.consumed}</div>
          <div className="text-xs text-muted-foreground">Sold / used</div>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2 text-center">
          <div className="text-xl font-bold">{totals.restocks}</div>
          <div className="text-xs text-muted-foreground">Restocked</div>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2 text-center">
          <div className="text-xl font-bold">{totals.wastage}</div>
          <div className="text-xs text-muted-foreground">Wastage</div>
        </div>
      </div>

      {/* Variance warnings */}
      {totals.variantCount > 0 ? (
        <div className="flex items-start gap-2 border-b border-border bg-destructive/10 px-4 py-3 text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            {totals.variantCount} product{totals.variantCount > 1 ? "s" : ""} short — physical count is below the system count. Verify before you leave.
          </p>
        </div>
      ) : null}
      {totals.overageCount > 0 ? (
        <div className="flex items-start gap-2 border-b border-border bg-secondary/50 px-4 py-3 text-secondary-foreground">
          <TrendingUp className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            {totals.overageCount} product{totals.overageCount > 1 ? "s" : ""} over — physical count is above the system count. May indicate an unrecorded restock.
          </p>
        </div>
      ) : null}

      {/* Product list */}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {sorted.map((p) => (
          <div
            key={p.productId}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3",
              p.variance > 0
                ? "border-destructive/30 bg-destructive/5"
                : p.variance < 0
                  ? "border-border bg-secondary/20"
                  : "border-border bg-card",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">
                expected {p.computedOnHand} · counted {p.physicalClose} {p.unit}
              </div>
            </div>
            {p.variance > 0 ? (
              <Badge variant="destructive" className="shrink-0 text-xs">
                {p.variance} short
              </Badge>
            ) : p.variance < 0 ? (
              <Badge variant="secondary" className="shrink-0 text-xs">
                +{Math.abs(p.variance)} over
              </Badge>
            ) : null}
          </div>
        ))}
      </div>

      {/* Sign out */}
      <div className="sticky bottom-0 border-t border-border bg-background px-4 py-3">
        <Button className="h-14 w-full text-base" onClick={onSignOut} disabled={pending}>
          {pending ? "Signing out…" : "Done — sign out"}
        </Button>
      </div>
    </div>
  );
}
