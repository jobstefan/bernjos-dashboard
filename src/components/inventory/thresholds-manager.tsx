"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  removeThresholdAction,
  saveThresholdAction,
} from "@/app/actions/inventory-catalog.actions";
import type { ProductRow, ThresholdRow } from "@/lib/types/inventory";

interface BranchOption {
  id: string;
  name: string;
}

export function ThresholdsManager({
  branches,
  products,
  thresholds,
}: {
  branches: BranchOption[];
  products: ProductRow[];
  thresholds: ThresholdRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [branchId, setBranchId] = React.useState(branches[0]?.id ?? "");

  // Current saved value per product for the selected branch.
  const saved = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const t of thresholds) {
      if (t.branchId === branchId) map.set(t.productId, t.reorderThreshold);
    }
    return map;
  }, [thresholds, branchId]);

  // Local edits keyed by productId (string, so empty is representable).
  const [draft, setDraft] = React.useState<Record<string, string>>({});

  function selectBranch(next: string | null) {
    setBranchId(next ?? "");
    setDraft({}); // discard unsaved edits when switching branches
  }

  function valueFor(productId: string): string {
    if (productId in draft) return draft[productId];
    const s = saved.get(productId);
    return s == null ? "" : String(s);
  }

  function save(productId: string) {
    const raw = valueFor(productId).trim();
    startTransition(async () => {
      const res =
        raw === ""
          ? await removeThresholdAction(branchId, productId)
          : await saveThresholdAction({ branchId, productId, reorderThreshold: Number(raw) });
      if (res.success) {
        toast.success("Reorder level saved.");
        setDraft((d) => {
          const next = { ...d };
          delete next[productId];
          return next;
        });
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const branchName = branches.find((b) => b.id === branchId)?.name ?? "Select branch";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Branch</span>
        <Select value={branchId} onValueChange={selectBranch}>
          <SelectTrigger className="w-56">
            <SelectValue>{branchName}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {products.map((p) => {
          const dirty = p.id in draft && valueFor(p.id) !== (saved.get(p.id)?.toString() ?? "");
          return (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.type === "sale" ? "Sale" : "Production"} · per {p.unit}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={valueFor(p.id)}
                  onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                  placeholder="—"
                  className="w-24"
                />
                <Button
                  size="sm"
                  variant={dirty ? "default" : "outline"}
                  disabled={pending || !dirty}
                  onClick={() => save(p.id)}
                >
                  Save
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Leave a value blank and save to clear a branch&apos;s reorder level for that product.
        Low-stock alerts fire when on-hand drops below the level set here.
      </p>
    </div>
  );
}
