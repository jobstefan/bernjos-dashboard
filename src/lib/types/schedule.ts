import type { BranchModel } from "@/generated/prisma/models";

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
  branchId: string | null;
  branchName: string | null;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  isDayOff: boolean;
}
