import type { SheetGrid } from "./types";

/** Zero-pad a number to two digits (`7` → `"07"`). */
export const pad = (n: number) => String(n).padStart(2, "0");

/** A single `HH:MM` punch time, anchored so partial matches are rejected. */
export const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export interface PeriodStart {
  year: number;
  month: number;
  day: number;
}

/** Find the period's first date from any header cell (handles both date orders). */
export function findPeriodStart(sheets: SheetGrid[]): PeriodStart | null {
  for (const sheet of sheets) {
    for (const row of sheet.rows) {
      for (const cell of row) {
        if (typeof cell !== "string") continue;
        const mdy = cell.match(/(\d{2})-(\d{2})-(\d{4})\s*~/); // MM-DD-YYYY
        if (mdy) return { year: +mdy[3], month: +mdy[1], day: +mdy[2] };
        const ymd = cell.match(/(\d{4})-(\d{2})-(\d{2})\s*~/); // YYYY-MM-DD
        if (ymd) return { year: +ymd[1], month: +ymd[2], day: +ymd[3] };
      }
    }
  }
  return null;
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** One clock event: a punch time (`HH:MM`) tagged as a clock-in or clock-out. */
export interface Punch {
  time: string;
  role: "in" | "out";
}

/**
 * Tag a chronological list of bare punch times as alternating in/out/in/out…
 * Used by formats (ZKTeco) that record only the raw times with no in/out column,
 * where the punches are already ordered through the day.
 */
export function chronologicalPunches(times: string[]): Punch[] {
  return times.map((time, i) => ({ time, role: i % 2 === 0 ? "in" : "out" }));
}

/**
 * Reduce a day's ordered punches to time-in, time-out and the total mid-shift gap
 * (minutes spent punched out between paired work sessions).
 *
 * A valid day pairs up as in→out→in→out…: an even count, alternating roles,
 * starting on an in and ending on an out. Then the gap is the sum of the spans
 * between one session's out and the next session's in. Anything else — a missing
 * punch, a lone clock-in, a doubled scan — yields a `null` gap, flagging the day
 * for a manual add-in rather than guessing.
 */
export function summarizePunches(punches: Punch[]): {
  timeIn: string | null;
  timeOut: string | null;
  gapStart: string | null;
  gapEnd: string | null;
  breakMinutes: number | null;
} {
  if (punches.length === 0) {
    return { timeIn: null, timeOut: null, gapStart: null, gapEnd: null, breakMinutes: 0 };
  }
  const timeIn = punches[0].time;
  const timeOut =
    punches.length > 1 ? punches[punches.length - 1].time : null;

  let paired = punches.length % 2 === 0;
  for (let i = 0; paired && i < punches.length; i++) {
    if (punches[i].role !== (i % 2 === 0 ? "in" : "out")) paired = false;
  }

  if (!paired) {
    // Unpaired (odd/missing punch): keep first & last as time-in/out, and place
    // each mid-day punch by its recorded role — a lunch-out → gap start, an
    // afternoon-in → gap end. So an afternoon-in with no lunch-out lands in
    // "mid-day in", not "mid-day out".
    const middle = punches.slice(1, -1);
    const gapStart = middle.find((p) => p.role === "out")?.time ?? null;
    const gapEnd = middle.find((p) => p.role === "in")?.time ?? null;

    // With no mid-day punches there's no gap to resolve, so the break is
    // unambiguously 0 — accept a plain in→out day even when the two punches were
    // mis-scanned as in→in (e.g. someone forgot to clock out). Only flag for
    // review when there *are* unpaired mid-day punches the total can't trust.
    const breakMinutes = timeOut !== null && middle.length === 0 ? 0 : null;
    return { timeIn, timeOut, gapStart, gapEnd, breakMinutes };
  }

  // First out punch is the gap start; first in-after-out is the gap end.
  const gapStart = punches.length >= 4 ? punches[1].time : null;
  const gapEnd = punches.length >= 4 ? punches[2].time : null;

  let gap = 0;
  for (let i = 1; i + 1 < punches.length; i += 2) {
    gap += toMinutes(punches[i + 1].time) - toMinutes(punches[i].time);
  }
  return { timeIn, timeOut, gapStart, gapEnd, breakMinutes: gap };
}

/** A day number → full `YYYY-MM-DD`, rolling into the next month when it wraps. */
export function resolveDate(day: number, start: PeriodStart): string {
  let { year, month } = start;
  if (day < start.day) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}
