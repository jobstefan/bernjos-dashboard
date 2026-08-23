import "server-only";
import {
  findEntriesByDate,
  findEntriesForEmployee,
  replaceDaySchedule,
  type DayEntryData,
} from "@/server/db/schedule";
import { findEmployeeByClerkId, findEmployees } from "@/server/db/employees";
import { auditLog } from "@/server/services/audit.service";
import { UnauthorizedError } from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type { ScheduleRow } from "@/lib/types/schedule";

/** Normalize any Date to UTC midnight so it matches the Postgres `@db.Date` column. */
function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

type EntryWithRelations = Awaited<ReturnType<typeof findEntriesByDate>>[number];

function entryToRow(entry: EntryWithRelations): ScheduleRow {
  return {
    employeeId: entry.employeeId,
    employeeCode: entry.employee.employeeCode,
    employeeName: `${entry.employee.firstName} ${entry.employee.lastName}`,
    department: entry.employee.department,
    branchId: entry.branchId,
    branchName: entry.branch?.name ?? null,
    startTime: entry.startTime,
    endTime: entry.endTime,
    note: entry.note,
    isDayOff: false,
  };
}

/**
 * The full board for a day: one row per active employee. Employees without an
 * entry are returned as day-off rows so the grid and copy-text list everyone.
 */
export async function getDaySchedule(date: Date): Promise<ScheduleRow[]> {
  const dateOnly = toDateOnly(date);
  const [employees, entries] = await Promise.all([
    findEmployees({ employmentStatus: "active" }),
    findEntriesByDate(dateOnly),
  ]);
  const byEmployee = new Map(entries.map((e) => [e.employeeId, e]));

  return employees.map((emp) => {
    const entry = byEmployee.get(emp.id);
    if (entry) return entryToRow(entry);
    return {
      employeeId: emp.id,
      employeeCode: emp.employeeCode,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      department: emp.department,
      branchId: null,
      branchName: null,
      startTime: null,
      endTime: null,
      note: null,
      isDayOff: true,
    };
  });
}

/** An employee's own upcoming entries (today through the next `days` days). */
export async function getMyUpcoming(
  clerkUserId: string,
  days = 30,
): Promise<{ date: string; row: ScheduleRow }[]> {
  const employee = await findEmployeeByClerkId(clerkUserId);
  if (!employee) {
    throw new UnauthorizedError(
      "Your account isn't linked to an employee profile. Please contact HR.",
    );
  }
  const from = toDateOnly(new Date());
  const to = new Date(from);
  to.setUTCDate(to.getUTCDate() + days);

  const entries = await findEntriesForEmployee(employee.id, from, to);
  return entries.map((entry) => ({
    date: entry.date.toISOString().slice(0, 10),
    row: entryToRow(entry),
  }));
}

/**
 * Replace a whole day's schedule with the given working entries (admin action).
 * Employees omitted from `entries` become day off (their row is removed).
 */
export async function saveDaySchedule(
  date: Date,
  entries: DayEntryData[],
  actor: Actor,
): Promise<void> {
  const dateOnly = toDateOnly(date);
  const before = await findEntriesByDate(dateOnly);
  await replaceDaySchedule(dateOnly, entries, actor.clerkUserId);
  const after = await findEntriesByDate(dateOnly);
  await auditLog({
    actor,
    action: "schedule.saved",
    entityType: "schedule",
    entityId: dateOnly.toISOString().slice(0, 10),
    before,
    after,
  });
}
