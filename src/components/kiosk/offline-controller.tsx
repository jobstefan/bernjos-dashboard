"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CloudOff, RefreshCw } from "lucide-react";
import {
  QUEUE_EVENT,
  allQueued,
  queuedCount,
  removeQueued,
} from "@/lib/kiosk/offline-queue";
import { syncOfflineEntriesAction } from "@/app/actions/inventory.actions";

export function OfflineController() {
  const router = useRouter();
  const [online, setOnline] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [pending, setPending] = React.useState(0);

  const flush = React.useCallback(async () => {
    if (syncing) return;
    const entries = await allQueued();
    if (entries.length === 0) return;
    setSyncing(true);
    const res = await syncOfflineEntriesAction({ entries });
    if (res.success) {
      // Every entry is now persisted server-side (applied or superseded); clear them.
      await removeQueued(entries.map((e) => e.clientId));
      const { applied, superseded } = res.data;
      if (applied > 0) toast.success(`Synced ${applied} offline ${applied === 1 ? "entry" : "entries"}.`);
      if (superseded.length > 0) {
        toast.warning(
          `${superseded.length} offline ${superseded.length === 1 ? "entry was" : "entries were"} overridden (an admin closed the session) and won't affect the counts.`,
        );
      }
      router.refresh();
    } else {
      toast.error(res.error);
    }
    setSyncing(false);
  }, [router, syncing]);

  // Register the kiosk service worker (offline app-shell).
  React.useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/kiosk-sw.js", { scope: "/kiosk" }).catch(() => {});
    }
  }, []);

  // Track connectivity + pending count; flush when we come back online.
  React.useEffect(() => {
    setOnline(navigator.onLine);
    queuedCount().then(setPending);

    const refreshCount = () => queuedCount().then(setPending);
    const goOnline = () => {
      setOnline(true);
      void flush();
    };
    const goOffline = () => setOnline(false);

    window.addEventListener(QUEUE_EVENT, refreshCount);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Attempt an initial flush in case entries were left from a previous session.
    if (navigator.onLine) void flush();

    return () => {
      window.removeEventListener(QUEUE_EVENT, refreshCount);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [flush]);

  if (online && !syncing && pending === 0) return null;

  return (
    <div
      className={
        "flex items-center gap-2 px-4 py-2 text-sm font-medium " +
        (online ? "bg-primary/10 text-primary" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")
      }
    >
      {online ? <RefreshCw className="size-4 animate-spin" /> : <CloudOff className="size-4" />}
      {!online
        ? `Offline — changes are saved on this device${pending > 0 ? ` (${pending} pending)` : ""}.`
        : syncing
          ? "Syncing offline changes…"
          : `${pending} change${pending === 1 ? "" : "s"} waiting to sync.`}
    </div>
  );
}
