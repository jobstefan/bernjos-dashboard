import { redirect } from "next/navigation";
import { canManageSchedule, canViewSchedule, getCurrentRole } from "@/lib/auth/rbac";
import { getDaySchedule } from "@/server/services/schedule.service";
import { getBranches } from "@/server/services/branch.service";
import { ScheduleBoard } from "@/components/schedule/schedule-board";

/** Local calendar day as `YYYY-MM-DD`. */
function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const role = await getCurrentRole();
  if (!canViewSchedule(role)) redirect("/");

  const { date } = await searchParams;
  const dateIso = date && DATE_RE.test(date) ? date : todayIso();

  const [rows, branches] = await Promise.all([
    getDaySchedule(new Date(`${dateIso}T00:00:00Z`)),
    getBranches(),
  ]);

  const workingCount = rows.filter((r) => !r.isDayOff).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Daily Schedule</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} employee{rows.length === 1 ? "" : "s"} ·{" "}
          {workingCount} working this day
        </p>
      </div>

      <ScheduleBoard
        dateIso={dateIso}
        rows={rows}
        branches={branches}
        canEdit={canManageSchedule(role)}
      />
    </div>
  );
}
