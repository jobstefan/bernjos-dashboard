"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HandCoins, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatPeso } from "@/lib/utils/payroll";
import { releaseBySlipAction } from "@/app/actions/inventory-release.actions";
import type { ReleasableItem } from "@/lib/types/inventory";

export function CashReleaseTab({ items }: { items: ReleasableItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [code, setCode] = React.useState("");
  const [releasingId, setReleasingId] = React.useState<string | null>(null);

  function release(slip: string, id?: string) {
    if (!slip.trim()) return;
    setReleasingId(id ?? "manual");
    startTransition(async () => {
      const res = await releaseBySlipAction(slip);
      if (res.success) {
        toast.success(`Released ${slip.trim().toUpperCase()}.`);
        setCode("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
      setReleasingId(null);
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Manual slip entry — the code is the verification (§5.8) */}
      <div className="rounded-xl border border-border bg-card p-4">
        <label className="text-sm font-medium">Release by slip code</label>
        <div className="mt-2 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CA-B0001-000123 or LN-…"
              className="h-12 pl-9 font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  release(code);
                }
              }}
            />
          </div>
          <Button
            className="h-12 px-6 text-base"
            disabled={pending || !code.trim()}
            onClick={() => release(code)}
          >
            Release
          </Button>
        </div>
      </div>

      {/* Awaiting release at this branch */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Awaiting release ({items.length})
        </h3>
        {items.length === 0 ? (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
            <HandCoins className="size-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing approved and waiting for this branch.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{item.employeeName}</span>
                    <Badge variant={item.kind === "loan" ? "secondary" : "default"}>
                      {item.kind === "loan" ? "Loan" : "Advance"}
                    </Badge>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {item.slipNumber ?? "—"}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="font-semibold tabular-nums">{formatPeso(item.amount)}</div>
                </div>
                <Button
                  className="h-11 px-5"
                  disabled={pending || !item.slipNumber}
                  onClick={() => item.slipNumber && release(item.slipNumber, item.id)}
                >
                  {pending && releasingId === item.id ? "…" : "Release"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
