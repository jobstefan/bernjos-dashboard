"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Segment-level error boundary for the dashboard. Catches unexpected server or
 * render errors (e.g. the database being unreachable) and offers a retry instead
 * of crashing the whole app.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for local debugging; production messages stay generic to users.
    console.error(error);
  }, [error]);

  const isDev = process.env.NODE_ENV !== "production";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Something went wrong</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        We couldn&apos;t complete that request. This is often a temporary
        connection issue — try again in a moment.
      </p>
      {isDev ? (
        <pre className="mt-4 max-w-lg overflow-x-auto rounded-lg bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
      ) : null}
      <Button className="mt-6" onClick={reset}>
        <RotateCcw className="size-4" /> Try again
      </Button>
    </div>
  );
}
