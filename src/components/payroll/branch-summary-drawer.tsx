"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { formatPeso } from "@/lib/utils/payroll";
import type { BranchSummaryLine } from "@/lib/types/payroll";

export function BranchSummaryDrawer({ summary }: { summary?: BranchSummaryLine[] }) {
  const [open, setOpen] = React.useState(false);

  const hasData = summary && summary.length > 0;

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
        description="Which branch owes what this period — net pay split by attendance, adjusted for tagged finance items."
      >
        {!hasData ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No branch data for this period.
          </p>
        ) : (
          <div className="space-y-4 pt-2">
            {summary.map((e) => (
              <div key={e.branchId ?? "unassigned"} className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{e.branchName}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.employeeCount} employee{e.employeeCount === 1 ? "" : "s"} ·{" "}
                      {e.daysWorked.toFixed(1)} day{e.daysWorked === 1 ? "" : "s"} worked
                    </p>
                  </div>
                  <span className="font-mono text-base font-bold">
                    {formatPeso(e.netToEmployees)}
                  </span>
                </div>

                {(e.taggedDeductions > 0 || e.taggedIncentives > 0) && (
                  <div className="border-t pt-2 space-y-1">
                    {e.taggedDeductions > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Tagged deductions</span>
                        <span className="font-mono text-destructive">
                          -{formatPeso(e.taggedDeductions)}
                        </span>
                      </div>
                    )}
                    {e.taggedIncentives > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Tagged incentives</span>
                        <span className="font-mono text-emerald-600">
                          +{formatPeso(e.taggedIncentives)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

          </div>
        )}
      </DetailDrawer>
    </>
  );
}
