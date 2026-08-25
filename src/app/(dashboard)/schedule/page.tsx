import { redirect } from "next/navigation";
import { canManageSchedule, canViewSchedule, getCurrentRole, isAdmin } from "@/lib/auth/rbac";
import { getDaySchedule } from "@/server/services/schedule.service";
import { getBranches } from "@/server/services/branch.service";
import { getAbsenceRequests } from "@/server/services/absence-request.service";
import { getEmployees } from "@/server/services/employee.service";
import { ScheduleBoard } from "@/components/schedule/schedule-board";
import { AbsenceRequestsPanel } from "@/components/schedule/absence-requests-panel";
import { AddAbsenceDialog } from "@/components/schedule/add-absence-dialog";
import { TodayRedirect } from "@/components/schedule/today-redirect";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function SchedulePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ date?: string }>;
}>) {
  const role = await getCurrentRole();
  if (!canViewSchedule(role)) redirect("/");

  const { date } = await searchParams;

  // No date param: let the client resolve its local today to avoid server/client timezone mismatch.
  if (!date || !DATE_RE.test(date)) return <TodayRedirect />;

  const dateIso = date;
  const dateObj = new Date(`${dateIso}T00:00:00Z`);

  const canManage = canManageSchedule(role);
  const canDecide = isAdmin(role);

  const [rows, branches, pendingRequests, dateRequests, employees] = await Promise.all([
    getDaySchedule(dateObj),
    getBranches(),
    getAbsenceRequests({ status: "pending" }),
    getAbsenceRequests({ date: dateObj }),
    canManage ? getEmployees({ employmentStatus: "active" }) : Promise.resolve([]),
  ]);

  const workingCount = rows.filter((r) => !r.isDayOff).length;

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    employeeCode: e.employeeCode,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Schedule</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} employee{rows.length === 1 ? "" : "s"} ·{" "}
            {workingCount} working this day
          </p>
        </div>
        {canManage ? (
          <AddAbsenceDialog employees={employeeOptions} defaultDate={dateIso} />
        ) : null}
      </div>

      <AbsenceRequestsPanel
        requests={pendingRequests}
        canDecide={canDecide}
      />

      <ScheduleBoard
        dateIso={dateIso}
        rows={rows}
        branches={branches}
        canEdit={canManage}
        absenceRequests={dateRequests}
      />
    </div>
  );
}
