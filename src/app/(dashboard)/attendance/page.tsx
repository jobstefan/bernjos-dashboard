import { redirect } from "next/navigation";
import { CalendarClock, UserCheck, CalendarOff, CalendarX } from "lucide-react";
import { canManageAttendance, getCurrentRole } from "@/lib/auth/rbac";
import {
  getComparison,
  getImports,
  getUploadBranches,
} from "@/server/services/attendance.service";
import { findBranches } from "@/server/db/branches";
import { getEmployees } from "@/server/services/employee.service";
import { UploadAttendanceButton } from "@/components/attendance/upload-dialog";
import { ComparisonTable } from "@/components/attendance/comparison-table";
import { UnmatchedPanel } from "@/components/attendance/unmatched-panel";
import { EmptyState } from "@/components/payroll/empty-state";
import { KpiCard } from "@/components/ui/kpi-card";
import { ChartCard } from "@/components/charts/chart-card";
import { AreaTrend } from "@/components/charts/area-trend";
import { BarSeries } from "@/components/charts/bar-series";
import { SEMANTIC_COLORS } from "@/components/charts/colors";
import type { AttendanceComparisonRow } from "@/lib/types/attendance";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildAttendanceStats(rows: AttendanceComparisonRow[]) {
  const byDate = new Map<string, { present: number; late: number; absent: number; total: number }>();
  const lateByEmployee = new Map<string, { name: string; minutes: number }>();

  for (const row of rows) {
    if (!byDate.has(row.date)) byDate.set(row.date, { present: 0, late: 0, absent: 0, total: 0 });
    const d = byDate.get(row.date)!;
    d.total++;
    if (row.status === "present") d.present++;
    else if (row.status === "late") { d.late++; d.present++; }
    else if (row.status === "absent") d.absent++;

    if (row.lateMinutes > 0) {
      const ex = lateByEmployee.get(row.employeeId);
      if (ex) ex.minutes += row.lateMinutes;
      else lateByEmployee.set(row.employeeId, { name: row.employeeName, minutes: row.lateMinutes });
    }
  }

  const points = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({
      date: date.slice(5),
      presentRate: d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
      lateCount: d.late,
      absentCount: d.absent,
    }));

  const totalPresent = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const totalLate = rows.filter((r) => r.status === "late").length;
  const totalAbsent = rows.filter((r) => r.status === "absent").length;
  const totalRequestedAbsence = rows.filter((r) => r.status === "requested-absence").length;
  const totalDayOff = rows.filter((r) => r.status === "day-off").length;

  const topLate = Array.from(lateByEmployee.values())
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 6)
    .map((e) => ({ employeeName: e.name, lateMinutes: e.minutes }));

  return { points, topLate, totalPresent, totalLate, totalAbsent, totalRequestedAbsence, totalDayOff };
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const role = await getCurrentRole();
  if (!canManageAttendance(role)) redirect("/");

  const { from, to } = await searchParams;
  const fromIso = from && DATE_RE.test(from) ? from : isoDaysAgo(13);
  const toIso = to && DATE_RE.test(to) ? to : isoDaysAgo(0);

  const [rows, imports, uploadBranches, employees, allBranches] = await Promise.all([
    getComparison(
      new Date(`${fromIso}T00:00:00.000Z`),
      new Date(`${toIso}T00:00:00.000Z`),
    ),
    getImports(),
    getUploadBranches(),
    getEmployees({ employmentStatus: "active" }),
    findBranches(),
  ]);

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    code: e.employeeCode,
    name: `${e.firstName} ${e.lastName}`,
  }));

  const stats = rows.length > 0 ? buildAttendanceStats(rows) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Biometric actuals vs the schedule — {rows.length} record{rows.length === 1 ? "" : "s"} in range.
          </p>
        </div>
        <UploadAttendanceButton branches={uploadBranches} />
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <input
            type="date"
            name="from"
            defaultValue={fromIso}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
          />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <input
            type="date"
            name="to"
            defaultValue={toIso}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground"
          />
        </div>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
      </form>

      {stats && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiCard label="Present" value={stats.totalPresent} icon={<UserCheck />} sheen />
            <KpiCard label="Req. Absence" value={stats.totalRequestedAbsence} icon={<CalendarX />} sheen={false} />
            <KpiCard label="Day-offs" value={stats.totalDayOff} icon={<CalendarOff />} sheen={false} />
          </div>

          {stats.points.length > 1 && (
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Presence Rate" description="Daily % present over range">
                <AreaTrend
                  data={stats.points}
                  xKey="date"
                  series={[
                    { key: "presentRate", label: "Present %", color: SEMANTIC_COLORS.net },
                    { key: "lateCount", label: "Late", color: SEMANTIC_COLORS.deductions },
                  ]}
                  format="count"
                />
              </ChartCard>

              {stats.topLate.length > 0 && (
                <ChartCard title="Most Late" description="Total late minutes in range">
                  <BarSeries
                    data={stats.topLate}
                    xKey="employeeName"
                    layout="vertical"
                    series={[{ key: "lateMinutes", label: "Late min", color: SEMANTIC_COLORS.deductions }]}
                    format="minutes"
                    height={stats.topLate.length * 40 + 20}
                  />
                </ChartCard>
              )}
            </div>
          )}
        </>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing to compare yet"
          description="Once a day has a schedule and an uploaded attendance record, the comparison shows here."
        />
      ) : (
        <ComparisonTable rows={rows} branches={allBranches} />
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">
          Uploads &amp; unmatched devices
        </h2>
        <UnmatchedPanel imports={imports} employees={employeeOptions} />
      </div>
    </div>
  );
}
