"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  approveAbsenceRequestAction,
  declineAbsenceRequestAction,
  deleteAbsenceRequestAction,
} from "@/app/actions/absence-request.actions";
import { formatScheduleDate } from "@/lib/utils/schedule";
import type { AbsenceRequestRow } from "@/server/services/absence-request.service";

function statusBadge(status: AbsenceRequestRow["status"]) {
  if (status === "approved") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        Approved
      </Badge>
    );
  }
  if (status === "declined") {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        Declined
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
      Pending
    </Badge>
  );
}

function AbsenceRequestRow({
  req,
  canDecide,
}: {
  req: AbsenceRequestRow;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function approve() {
    startTransition(async () => {
      const res = await approveAbsenceRequestAction(req.id);
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

  function remove() {
    startTransition(async () => {
      const res = await deleteAbsenceRequestAction(req.id);
      if (res.success) {
        toast.success(`Deleted ${req.employeeName}'s absence request.`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 font-medium">
          <span>{req.employeeName}</span>
          <span className="text-xs text-muted-foreground">
            {req.employeeCode}
          </span>
          {statusBadge(req.status)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatScheduleDate(req.date)}
          {req.reason ? ` · ${req.reason}` : ""}
        </div>
      </div>
      {canDecide ? (
        <div className="flex items-center gap-1">
          {req.status === "pending" ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={approve}
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
            </>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            disabled={pending}
            className="text-muted-foreground hover:text-destructive"
            title="Delete request"
            onClick={remove}
          >
            <Trash2 className="size-3.5" />
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
  if (requests.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Absence Requests</h2>
        <p className="text-xs text-muted-foreground">
          Pending and approved requests block employees from the schedule.
        </p>
      </div>
      <div className="divide-y divide-border">
        {requests.map((req) => (
          <AbsenceRequestRow key={req.id} req={req} canDecide={canDecide} />
        ))}
      </div>
    </div>
  );
}
