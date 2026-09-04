"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarRange, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approveAbsenceRequestAction,
  declineAbsenceRequestAction,
} from "@/app/actions/absence-request.actions";
import { ApproveAbsenceDialog } from "@/components/schedule/approve-absence-dialog";
import { formatDateRange, rangeDayCount } from "@/lib/utils/schedule";
import { toneClass } from "@/lib/utils/tone";
import type { AbsenceRequestRow } from "@/server/services/absence-request.service";

function statusBadge(status: AbsenceRequestRow["status"]) {
  const tone =
    status === "approved" ? "success" :
    status === "declined" ? "danger" :
    status === "cancelled" ? "neutral" :
    "warning";
  const label =
    status === "approved" ? "Approved" :
    status === "declined" ? "Declined" :
    status === "cancelled" ? "Cancelled" :
    "Pending";
  return (
    <span className={"inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " + toneClass(tone)}>
      {label}
    </span>
  );
}

function AbsenceRow({
  req,
  canDecide,
  onApprove,
}: {
  req: AbsenceRequestRow;
  canDecide: boolean;
  onApprove: (req: AbsenceRequestRow) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function approve() {
    startTransition(async () => {
      const res = await approveAbsenceRequestAction(req.id, req.startDate, req.startDate);
      if (res.success) {
        toast.success(`Approved ${req.employeeName}'s absence.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function decline() {
    startTransition(async () => {
      const res = await declineAbsenceRequestAction(req.id);
      if (res.success) {
        toast.success(`Declined ${req.employeeName}'s absence.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const dayCount = rangeDayCount(req.startDate, req.endDate);

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0 space-y-1">
        {/* Employee identity + status */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{req.employeeName}</span>
          <span className="text-xs text-muted-foreground">{req.employeeCode}</span>
          {statusBadge(req.status)}
        </div>

        {/* Date range — prominent, own line */}
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <CalendarRange className="size-3.5 shrink-0 text-muted-foreground" />
          {formatDateRange(req.startDate, req.endDate)}
          {dayCount > 1 ? (
            <span className="text-xs font-normal text-muted-foreground">
              ({dayCount} days)
            </span>
          ) : null}
        </div>

        {/* Reason — own line, visible */}
        {req.reason ? (
          <p className="text-sm text-foreground/80">{req.reason}</p>
        ) : null}

        {/* Decision note */}
        {req.decisionNote ? (
          <p className="text-xs text-muted-foreground">Note: {req.decisionNote}</p>
        ) : null}
      </div>

      {canDecide && req.status === "pending" ? (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => req.endDate ? onApprove(req) : approve()}
          >
            <Check className="size-3.5" />
            Approve
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            className="text-destructive hover:text-destructive"
            onClick={decline}
          >
            <X className="size-3.5" />
            Decline
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function AbsenceRequestsPanel({
  requests,
  canDecide,
}: {
  requests: AbsenceRequestRow[];
  canDecide: boolean;
}) {
  const [approving, setApproving] = React.useState<AbsenceRequestRow | null>(null);

  if (requests.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Absence Requests</h2>
          <p className="text-xs text-muted-foreground">
            Pending and approved requests block employees from the schedule.
          </p>
        </div>
        <div className="divide-y divide-border">
          {requests.map((req) => (
            <AbsenceRow
              key={req.id}
              req={req}
              canDecide={canDecide}
              onApprove={setApproving}
            />
          ))}
        </div>
      </div>
      <ApproveAbsenceDialog
        request={approving}
        onOpenChange={(open) => {
          if (!open) setApproving(null);
        }}
      />
    </>
  );
}
