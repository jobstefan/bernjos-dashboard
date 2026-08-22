import { GRACE_MINUTES } from "./config";

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
}

export interface DayComparison {
  status: AttendanceStatus;
  /** Minutes clocked in after shift start (0 if on time/early). Raw — grace not applied. */
  lateMinutes: number;
  /** Minutes clocked out before shift end (0 if none/complete). */
  undertimeMinutes: number;
  /** Scheduled shift length in minutes (0 when unscheduled) — for payroll pro-rating. */
  scheduledMinutes: number;
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
  opts: { graceMinutes?: number } = {},
): DayComparison {
  const grace = opts.graceMinutes ?? GRACE_MINUTES;

  // No schedule → nothing to measure against (e.g. worked on a day off).
  if (!input.startTime || !input.endTime) {
    return { status: "no-schedule", lateMinutes: 0, undertimeMinutes: 0, scheduledMinutes: 0 };
  }

  const startMin = toMinutes(input.startTime);
  let endMin = toMinutes(input.endTime);
  if (endMin <= startMin) endMin += 24 * 60; // overnight shift
  const scheduledMinutes = endMin - startMin;

  // Scheduled but no attendance row → absent.
  if (!input.timeIn) {
    return { status: "absent", lateMinutes: 0, undertimeMinutes: 0, scheduledMinutes };
  }

  const inMin = toMinutes(input.timeIn);
  const lateMinutes = Math.max(0, inMin - startMin);

  let undertimeMinutes = 0;
  if (input.timeOut) {
    let outMin = toMinutes(input.timeOut);
    if (outMin < inMin) outMin += 24 * 60; // clocked out past midnight
    undertimeMinutes = Math.max(0, endMin - outMin);
  }

  const status: AttendanceStatus = lateMinutes > grace ? "late" : "present";
  return { status, lateMinutes, undertimeMinutes, scheduledMinutes };
}
