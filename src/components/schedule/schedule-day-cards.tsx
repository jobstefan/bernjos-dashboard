"use client";

import * as React from "react";
import { Moon, CalendarOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelAbsenceRequestAction } from "@/app/actions/absence-request.actions";
import { toneClass } from "@/lib/utils/tone";
import { formatScheduleDate, formatTime12h } from "@/lib/utils/schedule";
import type { ScheduleDayItem } from "@/lib/types/schedule";

function AbsenceStatusBadge({ status }: { status: "pending" | "approved" | "declined" | "cancelled" }) {
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

function CancelAbsenceButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function cancel() {
    startTransition(async () => {
      const res = await cancelAbsenceRequestAction(requestId);
      if (res.success) {
        toast.success("Absence request cancelled.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
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
  );
}

// ─── Hero card ────────────────────────────────────────────────────────────────

export function ScheduleDayHero({
  item,
  label,
}: {
  item: ScheduleDayItem;
  label: string;
}) {

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted/40 border-b border-border">
        {label}
      </div>

      {item.type === "absence" ? (
        // Absence-only hero (no schedule entry)
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarOff className="size-4 shrink-0" />
              {formatScheduleDate(item.date)}
            </div>
            {item.request.reason ? (
              <div className="mt-0.5 text-sm text-muted-foreground italic">
                &ldquo;{item.request.reason}&rdquo;
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <AbsenceStatusBadge status={item.request.status} />
            {item.request.status === "pending" ? (
              <CancelAbsenceButton requestId={item.request.id} />
            ) : null}
          </div>
        </div>
      ) : item.type === "day-off" ? (
        // Day-off hero
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Moon className="size-4 shrink-0" />
              {formatScheduleDate(item.date)}
            </div>
            {item.request ? (
              item.request.reason ? (
                <div className="mt-0.5 text-sm text-muted-foreground italic">
                  &ldquo;{item.request.reason}&rdquo;
                </div>
              ) : null
            ) : (
              <div className="mt-0.5 text-sm text-muted-foreground">
                {item.row.branchName ?? "Unassigned"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {item.request ? (
              <>
                <AbsenceStatusBadge status={item.request.status} />
                {item.request.status === "pending" ? (
                  <CancelAbsenceButton requestId={item.request.id} />
                ) : null}
              </>
            ) : (
              <span className="font-mono text-2xl font-semibold tabular-nums text-muted-foreground">
                Day Off
              </span>
            )}
          </div>
        </div>
      ) : item.request?.status === "approved" ? (
        // Approved absence overrides the shift entirely
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarOff className="size-4 shrink-0" />
              {formatScheduleDate(item.date)}
            </div>
            {item.request.reason ? (
              <div className="mt-0.5 text-sm text-muted-foreground italic">
                &ldquo;{item.request.reason}&rdquo;
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <AbsenceStatusBadge status="approved" />
          </div>
        </div>
      ) : (
        // Shift hero (may also have a pending absence request alongside)
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <div className="text-sm text-muted-foreground">
              {formatScheduleDate(item.date)}
            </div>
            <div className="mt-0.5 font-medium">
              {item.row.branchName ?? "Unassigned"}
              {item.row.note ? ` · ${item.row.note}` : ""}
            </div>
            {item.request ? (
              <div className="mt-1 flex items-center gap-2">
                <AbsenceStatusBadge status={item.request.status} />
                {item.request.reason ? (
                  <span className="text-xs text-muted-foreground italic">
                    &ldquo;{item.request.reason}&rdquo;
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            {item.request?.status === "pending" ? (
              <CancelAbsenceButton requestId={item.request.id} />
            ) : null}
            <div className="font-mono text-2xl font-semibold tabular-nums">
              {item.row.startTime && item.row.endTime
                ? `${formatTime12h(item.row.startTime)} – ${formatTime12h(item.row.endTime)}`
                : "Day off"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── List row ─────────────────────────────────────────────────────────────────

export function ScheduleDayRow({ item }: { item: ScheduleDayItem }) {
  if (item.type === "absence") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-amber-50/60 dark:bg-amber-950/20">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <CalendarOff className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            {formatScheduleDate(item.date)}
            <AbsenceStatusBadge status={item.request.status} />
          </div>
          {item.request.reason ? (
            <div className="mt-0.5 text-xs text-muted-foreground italic">
              &ldquo;{item.request.reason}&rdquo;
            </div>
          ) : null}
        </div>
        {item.request.status === "pending" ? (
          <CancelAbsenceButton requestId={item.request.id} />
        ) : null}
      </div>
    );
  }

  if (item.type === "day-off") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-muted/30">
        <div>
          <div className="flex items-center gap-2 font-medium text-muted-foreground">
            <Moon className="size-4 shrink-0" />
            {formatScheduleDate(item.date)}
            {item.request ? <AbsenceStatusBadge status={item.request.status} /> : null}
          </div>
          {item.request?.reason ? (
            <div className="mt-0.5 text-xs text-muted-foreground italic">
              &ldquo;{item.request.reason}&rdquo;
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {item.request?.status === "pending" ? (
            <CancelAbsenceButton requestId={item.request.id} />
          ) : null}
          {!item.request ? (
            <span className="font-mono text-sm text-muted-foreground">Day Off</span>
          ) : null}
        </div>
      </div>
    );
  }

  // Shift row
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div>
        <div className="font-medium">{formatScheduleDate(item.date)}</div>
        <div className="text-xs text-muted-foreground">
          {item.row.branchName ?? "Unassigned"}
          {item.row.note ? ` · ${item.row.note}` : ""}
        </div>
        {item.request ? (
          <div className="mt-1 flex items-center gap-2">
            <AbsenceStatusBadge status={item.request.status} />
            {item.request.reason ? (
              <span className="text-xs text-muted-foreground italic">
                &ldquo;{item.request.reason}&rdquo;
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {item.request?.status === "pending" ? (
          <CancelAbsenceButton requestId={item.request.id} />
        ) : null}
        {item.request?.status !== "approved" ? (
          <div className="font-mono text-sm">
            {item.row.startTime && item.row.endTime
              ? `${formatTime12h(item.row.startTime)} – ${formatTime12h(item.row.endTime)}`
              : "Day off"}
          </div>
        ) : null}
      </div>
    </div>
  );
}
