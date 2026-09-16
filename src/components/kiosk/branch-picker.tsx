"use client";

import * as React from "react";
import { toast } from "sonner";
import { Tablet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setKioskBranchAction } from "@/app/actions/inventory.actions";

interface BranchOption {
  id: string;
  name: string;
  code: string | null;
}

/**
 * Shown when a device isn't yet pinned to a branch. The chosen branch becomes
 * the kiosk's identity for every session on this device (§5.1).
 */
export function BranchPicker({ branches }: { branches: BranchOption[] }) {
  const [pending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<string | null>(null);

  function assign(id: string) {
    setSelected(id);
    startTransition(async () => {
      const res = await setKioskBranchAction(id);
      if (res.success) {
        // Hard navigation so the server re-reads the newly set branch cookie.
        // router.push/refresh deduplicate same-URL navigations and won't re-render.
        window.location.href = "/kiosk";
      } else {
        setSelected(null);
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center p-6">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Tablet className="size-8" />
      </div>
      <h1 className="mt-6 text-2xl font-bold tracking-tight">Assign this tablet</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        Pick the branch this device belongs to. Everyone who signs in here will operate that
        branch&apos;s inventory.
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {branches.map((b) => (
          <Button
            key={b.id}
            variant="outline"
            className="h-auto justify-start gap-3 rounded-xl px-5 py-5 text-left"
            disabled={pending}
            onClick={() => assign(b.id)}
          >
            <div>
              <div className="text-base font-semibold">{b.name}</div>
              {b.code ? (
                <div className="font-mono text-xs text-muted-foreground">{b.code}</div>
              ) : null}
            </div>
            {pending && selected === b.id ? (
              <span className="ml-auto text-xs text-muted-foreground">Assigning…</span>
            ) : null}
          </Button>
        ))}
      </div>

      {branches.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          No branches exist yet. An admin needs to create one first.
        </p>
      ) : null}
    </div>
  );
}
