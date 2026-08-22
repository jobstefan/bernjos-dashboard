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
