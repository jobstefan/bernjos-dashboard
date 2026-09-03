"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelAbsenceRequestAction } from "@/app/actions/absence-request.actions";
import { formatScheduleDate } from "@/lib/utils/schedule";
import { toneClass } from "@/lib/utils/tone";
import type { AbsenceRequestRow } from "@/server/services/absence-request.service";

function statusLabel(status: AbsenceRequestRow["status"]) {
  const tone = status === "approved" ? "success" : status === "declined" ? "danger" : "warning";
  const label = status === "approved" ? "Approved" : status === "declined" ? "Declined" : "Pending";
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

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div>
        <div className="flex items-center gap-2 font-medium">
          {formatScheduleDate(req.date)}
          {statusLabel(req.status)}
        </div>
        {req.reason ? (
          <div className="text-xs text-muted-foreground">{req.reason}</div>
        ) : null}
        {req.decisionNote ? (
          <div className="text-xs text-muted-foreground">
            Note: {req.decisionNote}
          </div>
        ) : null}
      </div>
      {req.status === "pending" ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-destructive hover:text-destructive"
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
