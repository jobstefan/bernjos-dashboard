"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, Send, CheckCircle2, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  calculateRunAction,
  submitForApprovalAction,
  approveRunAction,
  markPaidAction,
} from "@/app/actions/payroll.actions";
import { EditPeriodDatesDialog } from "@/components/payroll/edit-period-dates-dialog";
import { DeletePeriodButton } from "@/components/payroll/delete-period-button";
import type { ActionResult } from "@/lib/types/action";
import type { PayrollStatus } from "@/lib/types/payroll";

interface PeriodMeta {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  notes?: string | null;
  frequency: "semi_monthly" | "monthly";
}

export function PeriodActions({
  periodId,
  status,
  isAdmin,
  isSuperAdmin,
  period,
}: {
  periodId: string;
  status: PayrollStatus;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  period: PeriodMeta;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(
    action: (id: string) => Promise<ActionResult>,
    successMsg: string,
  ) {
    startTransition(async () => {
      const res = await action(periodId);
      if (res.success) {
        toast.success(successMsg);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  // Managers can view but not mutate.
  if (!isAdmin) return null;

  const canDelete = isSuperAdmin && status !== "approved" && status !== "paid";
  const canEditDates = isSuperAdmin && status === "draft";

  let lifecycleButton: React.ReactNode = null;
  switch (status) {
    case "draft":
      lifecycleButton = (
        <Button
          disabled={pending}
          onClick={() => run(calculateRunAction, "Payroll calculated.")}
        >
          <Calculator className="size-4" />
          {pending ? "Calculating…" : "Calculate Run"}
        </Button>
      );
      break;
    case "calculated":
      lifecycleButton = (
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(calculateRunAction, "Payroll recalculated.")}
          >
            <Calculator className="size-4" /> Recalculate
          </Button>
          <Button
            className="bg-amber-600 hover:bg-amber-600/90"
            disabled={pending}
            onClick={() =>
              run(submitForApprovalAction, "Submitted for approval.")
            }
          >
            <Send className="size-4" /> Submit for Approval
          </Button>
        </div>
      );
      break;
    case "pending_approval":
      lifecycleButton = (
        <Button
          className="bg-green-600 hover:bg-green-600/90"
          disabled={pending}
          onClick={() => run(approveRunAction, "Payroll approved.")}
        >
          <CheckCircle2 className="size-4" /> Approve
        </Button>
      );
      break;
    case "approved":
      lifecycleButton = (
        <Button
          className="bg-emerald-600 hover:bg-emerald-600/90"
          disabled={pending}
          onClick={() => run(markPaidAction, "Payroll marked as paid.")}
        >
          <BadgeCheck className="size-4" /> Mark as Paid
        </Button>
      );
      break;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canDelete && <DeletePeriodButton periodId={periodId} />}
      {canEditDates && (
        <EditPeriodDatesDialog
          periodId={periodId}
          periodLabel={period.periodLabel}
          periodStart={period.periodStart}
          periodEnd={period.periodEnd}
          payDate={period.payDate}
          notes={period.notes}
          frequency={period.frequency}
        />
      )}
      {lifecycleButton}
    </div>
  );
}
