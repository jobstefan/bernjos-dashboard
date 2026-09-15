"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatPeso } from "@/lib/utils/payroll";
import { undoReleaseAction } from "@/app/actions/inventory-release.actions";
import type { ReleasedRow, UnreleasedRow } from "@/lib/types/inventory";

function KindBadge({ kind }: { kind: "advance" | "loan" }) {
  return (
    <Badge variant={kind === "loan" ? "secondary" : "default"}>
      {kind === "loan" ? "Loan" : "Advance"}
    </Badge>
  );
}

export function UnreleasedView({
  unreleased,
  released,
}: {
  unreleased: UnreleasedRow[];
  released: ReleasedRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [toUndo, setToUndo] = React.useState<ReleasedRow | null>(null);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground">
          Awaiting release ({unreleased.length})
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Approved advances and loans that no branch has released yet. They can&apos;t be deducted
          in payroll until released at the branch kiosk.
        </p>
        {unreleased.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
            Nothing waiting — every approved advance and loan has been released.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {unreleased.map((r) => (
              <div key={`${r.kind}-${r.id}`} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{r.employeeName}</span>
                    <KindBadge kind={r.kind} />
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.slipNumber ?? "—"} · {r.branchName ?? "No branch"}
                  </div>
                </div>
                <div className="ml-auto text-right">
                  <div className="font-semibold tabular-nums">{formatPeso(r.amount)}</div>
                  {r.ageDays != null ? (
                    <div
                      className={
                        r.ageDays >= 7
                          ? "text-xs font-medium text-destructive"
                          : "text-xs text-muted-foreground"
                      }
                    >
                      {r.ageDays === 0 ? "today" : `${r.ageDays}d waiting`}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground">
          Released — not yet in payroll ({released.length})
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Released but not yet swept into an approved payroll period. Undo is only possible while
          this is still true.
        </p>
        {released.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
            Nothing to correct.
          </p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {released.map((r) => (
              <div key={`${r.kind}-${r.id}`} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{r.employeeName}</span>
                    <KindBadge kind={r.kind} />
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {r.slipNumber ?? "—"} · released at {r.releaseBranchName ?? "—"}
                  </div>
                </div>
                <div className="ml-auto font-semibold tabular-nums">{formatPeso(r.amount)}</div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setToUndo(r)}
                >
                  Undo release
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={toUndo !== null} onOpenChange={(o) => !o && setToUndo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this release?</AlertDialogTitle>
            <AlertDialogDescription>
              {toUndo
                ? `${toUndo.slipNumber ?? "This item"} will go back to approved-but-unreleased and won't be deducted until it's released again. ${
                    toUndo.kind === "loan"
                      ? "The loan's repayment schedule will be removed."
                      : ""
                  }`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!toUndo) return;
                startTransition(async () => {
                  const res = await undoReleaseAction(toUndo.kind, toUndo.id);
                  if (res.success) {
                    toast.success("Release undone.");
                    setToUndo(null);
                    router.refresh();
                  } else {
                    toast.error(res.error);
                  }
                });
              }}
              disabled={pending}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {pending ? "Undoing…" : "Undo release"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
