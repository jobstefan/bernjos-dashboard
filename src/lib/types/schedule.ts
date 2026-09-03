import type { BranchModel } from "@/generated/prisma/models";
import type { AbsenceRequestRow } from "@/server/services/absence-request.service";

// Re-export the Prisma model under a friendly app-layer name.
export type Branch = BranchModel;

/** A branch flattened for display in a table. */
export interface BranchRow {
  id: string;
  name: string;
  address: string | null;
  attendanceFormat: string | null;
  createdAt: string;
}

/**
 * One employee's schedule for a day, flattened for display. Covers every active
 * employee: those with no entry that day have `isDayOff: true` and null times.
 */
export interface ScheduleRow {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  /** Employee's department name; drives the row's color accent on the board. */
  department: string;
  branchId: string | null;
  branchName: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  isDayOff: boolean;
}

export type ScheduleDayItem =
  | { type: "shift"; date: string; row: ScheduleRow; request?: AbsenceRequestRow }
  | { type: "day-off"; date: string; row: ScheduleRow; request?: AbsenceRequestRow }
  | { type: "absence"; date: string; request: AbsenceRequestRow };
