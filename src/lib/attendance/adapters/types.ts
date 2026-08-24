/**
 * The format-agnostic shape every biometric adapter emits: one normalized record
 * per employee-day. Everything downstream (matching, storage, comparison) works
 * only with this — format-specific quirks stay inside the adapters.
 */
export interface DailyRecord {
  /** The scanner's enrollment id, matched to an employee via EmployeeDevice. */
  deviceUserId: string;
  /** The name printed next to the id on the export, for the unmatched panel. */
  deviceName: string | null;
  /** Calendar date as `YYYY-MM-DD`. */
  date: string;
  /** Earliest punch of the day as `HH:MM` 24-hour, or null if none. */
  timeIn: string | null;
  /** Latest punch of the day as `HH:MM` 24-hour, or null if only one punch. */
  timeOut: string | null;
  /** First punch-out during the shift (`HH:MM`) — the mid-day gap start. */
  gapStart: string | null;
  /** First punch-back-in during the shift (`HH:MM`) — the mid-day gap end. */
  gapEnd: string | null;
  /**
   * Total mid-shift gap minutes (time punched out between first and last punch).
   * `0` for a clean day; `null` when punches don't pair (odd count) and the gap
   * can't be resolved — that day is flagged for a manual add-in.
   */
  breakMinutes: number | null;
  /** JSON-serializable snapshot of what this record was derived from (audit). */
  raw: unknown;
}

/** One worksheet as a dense array-of-arrays (row-major), header row(s) included. */
export interface SheetGrid {
  name: string;
  rows: unknown[][];
}

/**
 * A biometric export parser. Receives every worksheet in the uploaded workbook
 * (biometric exports are multi-sheet) and returns normalized day records. Adding
 * a genuinely different device = a new adapter implementing this interface.
 */
export interface AttendanceAdapter {
  /** Stable key stored on `Branch.attendanceFormat` and `AttendanceImport.format`. */
  format: string;
  /** Human label for the branch config dropdown. */
  label: string;
  parse(sheets: SheetGrid[]): DailyRecord[];
}
