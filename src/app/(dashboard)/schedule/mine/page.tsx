import { CalendarDays } from "lucide-react";
import { getActor } from "@/lib/auth/rbac";
import { getMyUpcoming } from "@/server/services/schedule.service";
import { getAbsenceRequestsForEmployee } from "@/server/services/absence-request.service";
import { getEmployeeByClerkUser } from "@/server/services/employee.service";
import { EmptyState } from "@/components/payroll/empty-state";
import { formatScheduleDate, formatTime12h } from "@/lib/utils/schedule";
import { RequestAbsenceDialog } from "@/components/schedule/request-absence-dialog";
import { MyAbsenceRequests } from "@/components/schedule/my-absence-requests";

export default async function MySchedulePage() {
  const actor = await getActor();
  const employee = await getEmployeeByClerkUser(actor.clerkUserId);

  let upcoming: Awaited<ReturnType<typeof getMyUpcoming>> = [];
  let error: string | null = null;
  try {
    upcoming = await getMyUpcoming(actor.clerkUserId);
  } catch (e) {
    error = e instanceof Error ? e.message : "Couldn't load your schedule.";
  }

  const absenceRequests = employee
    ? await getAbsenceRequestsForEmployee(employee.id)
    : [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const tomorrowIso = (() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  const heroEntry =
    upcoming.find(({ date }) => date === tomorrowIso) ??
    upcoming.find(({ date }) => date === todayIso);
  const listEntries = upcoming.filter(({ date }) => date !== heroEntry?.date);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Schedule</h1>
          <p className="text-sm text-muted-foreground">
            Your upcoming shifts for the next 30 days.
          </p>
        </div>
        {employee ? <RequestAbsenceDialog /> : null}
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
        <>
          {heroEntry ? (
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted/40 border-b border-border">
                {heroEntry.date === tomorrowIso ? "Tomorrow" : "Today"}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                <div>
                  <div className="text-sm text-muted-foreground">
                    {formatScheduleDate(heroEntry.date)}
                  </div>
                  <div className="mt-0.5 font-medium">
                    {heroEntry.row.branchName ?? "Unassigned"}
                    {heroEntry.row.note ? ` · ${heroEntry.row.note}` : ""}
                  </div>
                </div>
                <div className="font-mono text-2xl font-semibold tabular-nums">
                  {heroEntry.row.startTime && heroEntry.row.endTime
                    ? `${formatTime12h(heroEntry.row.startTime)} – ${formatTime12h(heroEntry.row.endTime)}`
                    : "Day off"}
                </div>
              </div>
            </div>
          ) : null}

          {listEntries.length > 0 ? (
            <div className="divide-y divide-border rounded-xl border border-border bg-card">
              {listEntries.map(({ date, row }) => (
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
          ) : null}
        </>
      )}

      {employee ? (
        <MyAbsenceRequests requests={absenceRequests} />
      ) : null}
    </div>
  );
}
