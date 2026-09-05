import type { AttendanceStatus } from "@/lib/attendance/compare";
import type { AbsenceRequestStatus } from "@/generated/prisma/enums";

/** One branch stint within a mid-day transfer day. */
export interface AttendanceBranchSegment {
  branchId: string | null;
  branchName: string | null;
  timeFrom: string; // HH:MM
  timeTo: string;   // HH:MM
  minutes: number;
}

/** One employee-day: schedule (target) vs attendance (actual), flattened for a table. */
export interface AttendanceComparisonRow {
  date: string; // YYYY-MM-DD
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualIn: string | null;
  actualOut: string | null;
  /** First punch-out during the shift — the mid-day gap start (`HH:MM`). */
  gapStart: string | null;
  /** First punch-back-in during the shift — the mid-day gap end (`HH:MM`). */
  gapEnd: string | null;
  /** Second mid-day gap start — manual add-in only. */
  gap2Start: string | null;
  /** Second mid-day gap end — manual add-in only. */
  gap2End: string | null;
  /** Origin of the actual record: parsed from an import, hand-edited, or none. */
  source: "biometric" | "manual" | "draft" | null;
  status: AttendanceStatus;
  lateMinutes: number;
  undertimeMinutes: number;
  /** Minutes clocked out after scheduled end (0 if none). */
  overtimeMinutes: number;
  /** Mid-shift gap minutes (time punched out between first and last punch). */
  breakMinutes: number;
  /** Punches didn't pair (odd count) — the mid-shift gap needs a manual add-in. */
  needsReview: boolean;
  /** Branch the employee was scheduled to work at that day. */
  branchName: string | null;
  /** Branch from the actual attendance record (may differ from scheduled branch). */
  attendanceBranchId: string | null;
  /** Sub-day branch segments — only populated on transfer days. */
  branchSegments: AttendanceBranchSegment[];
  /** Absence request for this day, if one exists (pending or approved). */
  absenceRequest: { id: string; status: AbsenceRequestStatus; reason: string | null } | null;
}

/** An enrollment id from an export with no matching employee, plus its printed name. */
export interface UnmatchedDevice {
  deviceUserId: string;
  name: string | null;
}

/** An upload batch, flattened for display. */
export interface AttendanceImportRow {
  id: string;
  branchId: string;
  branchName: string;
  fileName: string;
  format: string;
  status: string;
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  unmatched: UnmatchedDevice[];
  errorMessage: string | null;
  createdAt: string;
}

/** A branch that can accept attendance uploads (has a format configured). */
export interface AttendanceBranchOption {
  id: string;
  name: string;
  attendanceFormat: string;
}

/** Per-employee attendance rolled up over a payroll period. */
export interface PayrollAttendanceSummary {
  /** False when the employee has no schedule in the period (attendance not used). */
  hasSchedule: boolean;
  scheduledDays: number;
  /** Scheduled days that were attended (present or late). */
  daysWorked: number;
  /** Scheduled days with no attendance record. */
  absentDays: number;
  /** Deductible late minutes (from the first minute), summed across the period. */
  lateMinutes: number;
  /** Early-out minutes, summed across the period. */
  undertimeMinutes: number;
  /** Minutes worked past scheduled end, summed across the period. */
  overtimeMinutes: number;
  /** Total scheduled shift minutes across the period (used to derive per-minute rate). */
  scheduledMinutes: number;
  /** Mid-shift gap minutes (left and came back), summed across the period. */
  breakMinutes: number;
  /** Late+undertime+break expressed as fractional days (pro-rated by each shift's length). */
  deductionDays: number;
  /**
   * Days worked grouped by the branch that recorded them (attendance record's
   * branch, falling back to the scheduled branch). A null `branchId` buckets days
   * whose branch couldn't be resolved. Empty when the employee isn't attendance-tracked.
   */
  byBranch: { branchId: string | null; daysWorked: number }[];
}
