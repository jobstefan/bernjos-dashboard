"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { correctEntryAction } from "@/app/actions/inventory-corrections.actions";
import type { CorrectionEntryRow } from "@/lib/types/inventory";

const TYPE_LABEL: Record<string, string> = {
  opening: "Opening",
  restock: "Restock",
  wastage: "Wastage",
  closing: "Closing",
  bst_in: "Transfer in",
  bst_out: "Transfer out",
};

export function CorrectionsEditor({ entries }: { entries: CorrectionEntryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [savingId, setSavingId] = React.useState<string | null>(null);

  function save(entry: CorrectionEntryRow) {
    const raw = draft[entry.id];
    if (raw === undefined || raw === "" || Number(raw) === entry.quantity) return;
    setSavingId(entry.id);
    startTransition(async () => {
      const res = await correctEntryAction(entry.id, Number(raw));
      if (res.success) {
        toast.success("Entry corrected.");
        setDraft((d) => {
          const next = { ...d };
          delete next[entry.id];
          return next;
        });
        router.refresh();
      } else {
        toast.error(res.error);
      }
      setSavingId(null);
    });
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        This session has no entries.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-card">
      {entries.map((e) => {
        const value = draft[e.id] ?? String(e.quantity);
        const dirty = e.id in draft && Number(value) !== e.quantity;
        return (
          <div key={e.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{e.productName}</span>
                <Badge variant="outline">{TYPE_LABEL[e.type] ?? e.type}</Badge>
                {e.wastageReason ? (
                  <span className="text-xs text-muted-foreground">{e.wastageReason}</span>
                ) : null}
              </div>
              {e.note ? <div className="text-xs text-muted-foreground">{e.note}</div> : null}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={value}
                onChange={(ev) => setDraft((d) => ({ ...d, [e.id]: ev.target.value }))}
                className="h-10 w-24 text-center"
              />
              <span className="w-8 text-xs text-muted-foreground">{e.unit}</span>
              <Button
                size="sm"
                variant={dirty ? "default" : "outline"}
                disabled={pending || !dirty}
                onClick={() => save(e)}
              >
                {pending && savingId === e.id ? "…" : "Save"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
