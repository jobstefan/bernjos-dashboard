"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelAbsenceRequestAction } from "@/app/actions/absence-request.actions";
import { formatDateRange, rangeDayCount } from "@/lib/utils/schedule";
import { toneClass } from "@/lib/utils/tone";
import type { AbsenceRequestRow } from "@/server/services/absence-request.service";

function statusLabel(status: AbsenceRequestRow["status"]) {
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

function AbsenceRow({ req }: { req: AbsenceRequestRow }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function cancel() {
    startTransition(async () => {
      const res = await cancelAbsenceRequestAction(req.id);
      if (res.success) {
        toast.success("Absence request cancelled.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const dayCount = rangeDayCount(req.startDate, req.endDate);

  return (
    <div className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
      <div className="space-y-1">
        {/* Date range + status badge — prominent */}
        <div className="flex flex-wrap items-center gap-2">
          <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-semibold">
            {formatDateRange(req.startDate, req.endDate)}
          </span>
          {dayCount > 1 ? (
            <span className="text-xs text-muted-foreground">({dayCount} days)</span>
          ) : null}
          {statusLabel(req.status)}
        </div>

        {/* Reason — visible, not muted */}
        {req.reason ? (
          <p className="text-sm text-foreground/80 line-clamp-2">{req.reason}</p>
        ) : null}

        {/* Decision note */}
        {req.decisionNote ? (
          <p className="text-xs text-muted-foreground">Note: {req.decisionNote}</p>
        ) : null}
      </div>

      {req.status === "pending" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-destructive hover:text-destructive shrink-0"
          onClick={cancel}
        >
          {pending ? "Cancelling…" : "Cancel"}
        </Button>
      ) : null}
    </div>
  );
}

export function MyAbsenceRequests({
  requests,
}: {
  requests: AbsenceRequestRow[];
}) {
  if (requests.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-base font-semibold">Declined Requests</h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {requests.map((req) => (
          <AbsenceRow key={req.id} req={req} />
        ))}
      </div>
    </div>
  );
}
