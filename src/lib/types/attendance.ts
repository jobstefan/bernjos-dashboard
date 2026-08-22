import type { AttendanceStatus } from "@/lib/attendance/compare";

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
  /** Origin of the actual record: parsed from an import, hand-edited, or none. */
  source: "biometric" | "manual" | null;
  status: AttendanceStatus;
  lateMinutes: number;
  undertimeMinutes: number;
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
  /** Late+undertime expressed as fractional days (pro-rated by each shift's length). */
  deductionDays: number;
}
