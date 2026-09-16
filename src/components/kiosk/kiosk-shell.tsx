"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, ArrowLeftRight, HandCoins, AlertTriangle, Play, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CountingTab } from "@/components/kiosk/counting-tab";
import { CashReleaseTab } from "@/components/kiosk/cash-release-tab";
import { TransfersTab } from "@/components/kiosk/transfers-tab";
import { OfflineController } from "@/components/kiosk/offline-controller";
import {
  clearKioskBranchAction,
  openSessionAction,
} from "@/app/actions/inventory.actions";
import type { KioskState, ReleasableItem, TransferRow } from "@/lib/types/inventory";

type Tab = "counting" | "transfers" | "release";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "counting", label: "Counting", icon: ClipboardList },
  { id: "transfers", label: "Transfers", icon: ArrowLeftRight },
  { id: "release", label: "Cash Release", icon: HandCoins },
];

export function KioskShell({
  state,
  releasable,
  transfers,
  branches,
  canRepin,
}: {
  state: KioskState;
  releasable: ReleasableItem[];
  transfers: TransferRow[];
  branches: { id: string; name: string }[];
  canRepin: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("counting");
  const [pending, startTransition] = React.useTransition();

  const session = state.session;
  const sessionOpen = session !== null && !session.closed;

  const transferBadge = transfers.filter(
    (t) =>
      (t.status === "approved" && t.sourceBranchId === state.branch.id) ||
      (t.status === "prepared" && t.destBranchId === state.branch.id),
  ).length;
  const tabCounts: Record<Tab, number> = {
    counting: state.lowStockCount,
    transfers: transferBadge,
    release: releasable.length,
  };

  const dateLabel = new Date(
    session?.sessionDate ?? new Date().toISOString(),
  ).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

  function openSession() {
    startTransition(async () => {
      const res = await openSessionAction();
      if (res.success) {
        toast.success("Session ready.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function repin() {
    startTransition(async () => {
      const res = await clearKioskBranchAction();
      if (res.success) router.refresh();
      else toast.error(res.error);
    });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-lg font-bold">{state.branch.name}</div>
          <div className="text-xs text-muted-foreground">
            {dateLabel}
            {session?.closed ? " · closed" : sessionOpen ? " · open" : " · not started"}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {state.lowStockCount > 0 ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="size-3.5" />
              {state.lowStockCount} low
            </Badge>
          ) : null}
          {canRepin ? (
            <Button variant="ghost" size="sm" onClick={repin} disabled={pending}>
              Re-assign
            </Button>
          ) : null}
        </div>
      </header>

      <OfflineController />

      {/* POS-style tabs */}
      <nav className="flex border-b border-border bg-card">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-3 text-sm font-medium transition-colors",
                active
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-5" />
              {t.label}
              {tabCounts[t.id] > 0 ? (
                <span className="absolute right-2 top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  {tabCounts[t.id]}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <main className="flex-1 p-4">
        {tab === "counting" ? (
          sessionOpen && session ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Tap a product to restock. Log wastage with the trash icon.
                </p>
                <Button variant="outline" onClick={() => router.push("/kiosk/close")} disabled={pending}>
                  <Lock className="size-4" /> Close session
                </Button>
              </div>
              <CountingTab sessionId={session.id} state={state} />
            </div>
          ) : (
            <SessionPrompt closed={session?.closed ?? false} pending={pending} onOpen={openSession} />
          )
        ) : null}

        {tab === "transfers" ? (
          <TransfersTab
            branchId={state.branch.id}
            transfers={transfers}
            branches={branches}
            products={state.products}
          />
        ) : null}
        {tab === "release" ? <CashReleaseTab items={releasable} /> : null}
      </main>
    </div>
  );
}

function SessionPrompt({
  closed,
  pending,
  onOpen,
}: {
  closed: boolean;
  pending: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Play className="size-7" />
      </div>
      <h2 className="mt-5 text-xl font-bold">
        {closed ? "Today's session is closed" : "Start today's session"}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {closed
          ? "The closing count is in. An admin can still make corrections."
          : "Opening counts carry over from yesterday's close. You can restock and log wastage once it's open."}
      </p>
      {!closed ? (
        <Button className="mt-6 h-12 px-8 text-base" onClick={onOpen} disabled={pending}>
          {pending ? "Opening…" : "Open session"}
        </Button>
      ) : null}
    </div>
  );
}
