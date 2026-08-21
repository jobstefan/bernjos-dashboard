import { CalendarDays } from "lucide-react";
import { getActor } from "@/lib/auth/rbac";
import { getMyUpcoming } from "@/server/services/schedule.service";
import { EmptyState } from "@/components/payroll/empty-state";
import { formatScheduleDate, formatTime12h } from "@/lib/utils/schedule";

export default async function MySchedulePage() {
  const actor = await getActor();

  let upcoming: Awaited<ReturnType<typeof getMyUpcoming>> = [];
  let error: string | null = null;
  try {
    upcoming = await getMyUpcoming(actor.clerkUserId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Couldn't load your schedule.";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Schedule</h1>
        <p className="text-sm text-muted-foreground">
          Your upcoming shifts for the next 30 days.
        </p>
      </div>

      {error ? (
        <EmptyState
          icon={CalendarDays}
          title="Schedule unavailable"
          description={error}
        />
      ) : upcoming.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No upcoming shifts"
          description="When the owner publishes your schedule, your shifts will show up here."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-white">
          {upcoming.map(({ date, row }) => (
            <div
              key={date}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            >
              <div>
                <div className="font-medium">{formatScheduleDate(date)}</div>
                <div className="text-xs text-muted-foreground">
                  {row.branchName ?? "Unassigned"}
                  {row.note ? ` · ${row.note}` : ""}
                </div>
              </div>
              <div className="font-mono text-sm">
                {row.startTime && row.endTime
                  ? `${formatTime12h(row.startTime)} – ${formatTime12h(row.endTime)}`
                  : "Day off"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
