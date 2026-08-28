import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { canManageAttendance, getCurrentRole } from "@/lib/auth/rbac";
import {
  getComparison,
  getImports,
  getUploadBranches,
} from "@/server/services/attendance.service";
import { getEmployees } from "@/server/services/employee.service";
import { UploadAttendanceButton } from "@/components/attendance/upload-dialog";
import { ComparisonTable } from "@/components/attendance/comparison-table";
import { UnmatchedPanel } from "@/components/attendance/unmatched-panel";
import { EmptyState } from "@/components/payroll/empty-state";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
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

  const [rows, imports, branches, employees] = await Promise.all([
    getComparison(
      new Date(`${fromIso}T00:00:00.000Z`),
      new Date(`${toIso}T00:00:00.000Z`),
    ),
    getImports(),
    getUploadBranches(),
    getEmployees({ employmentStatus: "active" }),
  ]);

  const employeeOptions = employees.map((e) => ({
    id: e.id,
    code: e.employeeCode,
    name: `${e.firstName} ${e.lastName}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            Biometric actuals vs the schedule — {rows.length} day
            {rows.length === 1 ? "" : "s"} in range. Records are stored in the
            dashboard database (not the uploaded file) and can be edited by hand.
          </p>
        </div>
        <UploadAttendanceButton branches={branches} />
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

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Nothing to compare yet"
          description="Once a day has a schedule and an uploaded attendance record, the comparison shows here."
        />
      ) : (
        <ComparisonTable rows={rows} />
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
