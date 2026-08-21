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
import type { ActionResult } from "@/lib/types/action";
import type { PayrollStatus } from "@/lib/types/payroll";

export function PeriodActions({
  periodId,
  status,
  isAdmin,
}: {
  periodId: string;
  status: PayrollStatus;
  isAdmin: boolean;
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

  switch (status) {
    case "draft":
      return (
        <Button
          disabled={pending}
          onClick={() => run(calculateRunAction, "Payroll calculated.")}
        >
          <Calculator className="size-4" />
          {pending ? "Calculating…" : "Calculate Run"}
        </Button>
      );
    case "calculated":
      return (
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
    case "pending_approval":
      return (
        <Button
          className="bg-green-600 hover:bg-green-600/90"
          disabled={pending}
          onClick={() => run(approveRunAction, "Payroll approved.")}
        >
          <CheckCircle2 className="size-4" /> Approve
        </Button>
      );
    case "approved":
      return (
        <Button
          className="bg-emerald-600 hover:bg-emerald-600/90"
          disabled={pending}
          onClick={() => run(markPaidAction, "Payroll marked as paid.")}
        >
          <BadgeCheck className="size-4" /> Mark as Paid
        </Button>
      );
    case "paid":
    default:
      return null;
  }
}
