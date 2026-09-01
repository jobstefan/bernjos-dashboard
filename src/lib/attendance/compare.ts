import { DEPT_SHIFT_BREAK_BUFFER_HOURS, GRACE_MINUTES, OT_GRACE_MINUTES } from "./config";

export type AttendanceStatus = "present" | "late" | "absent" | "no-schedule";

export interface DayComparisonInput {
  /** Scheduled shift start `HH:MM`, or null if the employee isn't scheduled. */
  startTime: string | null;
  /** Scheduled shift end `HH:MM`. */
  endTime: string | null;
  /** Actual clock-in `HH:MM`, or null if there's no attendance record. */
  timeIn: string | null;
  /** Actual clock-out `HH:MM`. */
  timeOut: string | null;
  /**
   * Mid-shift gap minutes (time punched out between first and last punch). `0`
   * for a clean day; `null` when punches didn't pair and the gap is unresolved —
   * treated as 0 for the math but surfaced via `needsReview` for a manual add-in.
   */
  breakMinutes?: number | null;
}

export interface DayComparison {
  status: AttendanceStatus;
  /** Minutes clocked in after shift start (0 if on time/early). Raw — grace not applied. */
  lateMinutes: number;
  /** Minutes clocked out before shift end (0 if none/complete). */
  undertimeMinutes: number;
  /** Minutes clocked out after shift end (0 if none). */
  overtimeMinutes: number;
  /** Mid-shift gap minutes deducted (time punched out between first and last punch). */
  breakMinutes: number;
  /** Scheduled shift length in minutes (0 when unscheduled) — for payroll pro-rating. */
  scheduledMinutes: number;
  /** The employee clocked in but their punches didn't pair — needs a manual gap entry. */
  needsReview: boolean;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Compare one day's schedule (target) against actual attendance. Pure and
 * unit-testable. Overnight shifts (end ≤ start) treat the end as the next day.
 */
export function compareDay(
  input: DayComparisonInput,
  opts: { graceMinutes?: number; deptShiftHours?: number } = {},
): DayComparison {
  const grace = opts.graceMinutes ?? GRACE_MINUTES;

  // No schedule → nothing to measure against (e.g. worked on a day off).
  if (!input.startTime || !input.endTime) {
    return {
      status: "no-schedule",
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      breakMinutes: 0,
      scheduledMinutes: 0,
      needsReview: false,
    };
  }

  const startMin = toMinutes(input.startTime);
  let endMin = toMinutes(input.endTime);
  if (endMin <= startMin) endMin += 24 * 60; // overnight shift
  const scheduledMinutes = endMin - startMin;

  // Scheduled but no attendance row → absent.
  if (!input.timeIn) {
    return {
      status: "absent",
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      breakMinutes: 0,
      scheduledMinutes,
      needsReview: false,
    };
  }

  const inMin = toMinutes(input.timeIn);
  const lateMinutes = Math.max(0, inMin - startMin);

  // Dept shift threshold is the sole reference for undertime/OT when available.
  // Anchored to scheduled start (not actual clock-in) so late arrivals don't
  // push the threshold later and double-penalise the employee.
  // Falls back to scheduled end when no dept shift hours are provided.
  const effectiveEnd =
    opts.deptShiftHours != null
      ? startMin + (opts.deptShiftHours + DEPT_SHIFT_BREAK_BUFFER_HOURS) * 60
      : endMin;

  let undertimeMinutes = 0;
  let overtimeMinutes = 0;
  if (input.timeOut) {
    let outMin = toMinutes(input.timeOut);
    if (outMin < inMin) outMin += 24 * 60; // clocked out past midnight
    undertimeMinutes = Math.max(0, effectiveEnd - outMin);
    const rawOt = Math.max(0, outMin - effectiveEnd);
    overtimeMinutes = rawOt > OT_GRACE_MINUTES ? rawOt - OT_GRACE_MINUTES : 0;
  }

  // Unresolved (odd) punches deduct nothing until an admin adds the gap manually.
  const needsReview = input.breakMinutes === null;
  const breakMinutes = input.breakMinutes ?? 0;

  const status: AttendanceStatus = lateMinutes > grace ? "late" : "present";
  return { status, lateMinutes, undertimeMinutes, overtimeMinutes, breakMinutes, scheduledMinutes, needsReview };
}
