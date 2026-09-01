"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Separator } from "@/components/ui/separator";
import { formatPeso } from "@/lib/utils/payroll";
import type { RunItemRow } from "@/components/payroll/run-items-table";

interface BranchSummaryEntry {
  branchName: string;
  netPay: number;
  employeeCount: number;
  daysWorked: number;
}

function aggregateByBranch(rows: RunItemRow[]): BranchSummaryEntry[] {
  const map = new Map<string, { netPay: number; employeeIds: Set<string>; daysWorked: number }>();
  for (const row of rows) {
    for (const b of row.branchBreakdown) {
      const cur = map.get(b.branchName) ?? { netPay: 0, employeeIds: new Set(), daysWorked: 0 };
      cur.netPay += b.netPay;
      cur.employeeIds.add(row.employeeId);
      cur.daysWorked += b.daysWorked;
      map.set(b.branchName, cur);
    }
  }
  return Array.from(map.entries())
    .map(([branchName, v]) => ({
      branchName,
      netPay: v.netPay,
      employeeCount: v.employeeIds.size,
      daysWorked: v.daysWorked,
    }))
    .sort((a, b) => b.netPay - a.netPay);
}

export function BranchSummaryDrawer({ rows }: { rows: RunItemRow[] }) {
  const [open, setOpen] = React.useState(false);
  const entries = React.useMemo(() => aggregateByBranch(rows), [rows]);
  const totalNetPay = entries.reduce((s, e) => s + e.netPay, 0);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Building2 className="mr-2 size-4" />
        Branch Summary
      </Button>

      <DetailDrawer
        open={open}
        onOpenChange={setOpen}
        title="Branch Summary"
        description="Net pay owed per branch this period, based on days worked."
      >
        {entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No branch data for this period.
          </p>
        ) : (
          <div className="space-y-4 pt-2">
            {entries.map((e) => (
              <div key={e.branchName} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{e.branchName}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.employeeCount} employee{e.employeeCount === 1 ? "" : "s"} ·{" "}
                      {e.daysWorked.toFixed(1)} day{e.daysWorked === 1 ? "" : "s"} worked
                    </p>
                  </div>
                  <span className="font-mono text-base font-bold">{formatPeso(e.netPay)}</span>
                </div>
              </div>
            ))}

            <Separator />

            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
              <span className="text-sm font-semibold">Total</span>
              <span className="font-mono text-base font-bold">{formatPeso(totalNetPay)}</span>
            </div>
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
