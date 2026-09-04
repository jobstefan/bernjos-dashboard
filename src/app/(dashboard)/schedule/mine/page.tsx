import { CalendarDays } from "lucide-react";
import { getActor } from "@/lib/auth/rbac";
import { getMyUpcoming } from "@/server/services/schedule.service";
import { getAbsenceRequestsForEmployee } from "@/server/services/absence-request.service";
import { getEmployeeByClerkUser } from "@/server/services/employee.service";
import { EmptyState } from "@/components/payroll/empty-state";
import { RequestAbsenceDialog } from "@/components/schedule/request-absence-dialog";
import { MyAbsenceRequests } from "@/components/schedule/my-absence-requests";
import { ScheduleDayHero, ScheduleDayRow } from "@/components/schedule/schedule-day-cards";
import { expandDateRange } from "@/lib/utils/schedule";
import type { ScheduleDayItem } from "@/lib/types/schedule";

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

  // Build merged timeline — expand date ranges into per-day entries.
  // Only active (pending/approved) requests block schedule days.
  const absenceByDate = new Map(
    absenceRequests
      .filter((r) => r.status === "pending" || r.status === "approved")
      .flatMap((r) =>
        expandDateRange(r.startDate, r.endDate ?? r.startDate)
          .filter((d) => d >= todayIso)
          .map((d) => [d, r] as [string, typeof r]),
      ),
  );
  const scheduledDates = new Set(upcoming.map((u) => u.date));

  const items: ScheduleDayItem[] = [
    ...upcoming.map(({ date, row }): ScheduleDayItem => {
      const request = absenceByDate.get(date);
      return row.isDayOff
        ? { type: "day-off", date, row, request }
        : { type: "shift", date, row, request };
    }),
    ...absenceRequests
      .filter((r) => r.status === "pending" || r.status === "approved")
      .flatMap((r) =>
        expandDateRange(r.startDate, r.endDate ?? r.startDate)
          .filter((d) => d >= todayIso && !scheduledDates.has(d))
          .map((d): ScheduleDayItem => ({ type: "absence", date: d, request: r })),
      ),
  ].sort((a, b) => a.date.localeCompare(b.date));

  const heroItem =
    items.find((i) => i.date === tomorrowIso) ??
    items.find((i) => i.date === todayIso);
  const listItems = items.filter((i) => i.date !== heroItem?.date);

  const declinedRequests = absenceRequests.filter(
    (r) => r.status === "declined" || r.status === "cancelled",
  );

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
      ) : items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No upcoming shifts"
          description="When the owner publishes your schedule, your shifts will show up here."
        />
      ) : (
        <>
          {heroItem ? (
            <ScheduleDayHero
              item={heroItem}
              label={heroItem.date === tomorrowIso ? "Tomorrow" : "Today"}
            />
          ) : null}

          {listItems.length > 0 ? (
            <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
              {listItems.map((item) => (
                <ScheduleDayRow key={item.date} item={item} />
              ))}
            </div>
          ) : null}
        </>
      )}

      {declinedRequests.length > 0 ? (
        <MyAbsenceRequests requests={declinedRequests} />
      ) : null}
    </div>
  );
}
