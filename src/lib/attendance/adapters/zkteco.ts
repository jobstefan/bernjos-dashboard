import { findPeriodStart, pad, resolveDate, TIME_RE } from "./shared";
import type { AttendanceAdapter, DailyRecord, SheetGrid } from "./types";

/**
 * ZKTeco exports, read from the "Att.log report" (Attendance Record Report) sheet —
 * the only place that carries the raw punches rather than a schedule-matched view.
 *
 * Layout: a day-header row lists the period's day numbers, one per column
 * (`"14"`…`"29"`). Each employee is then a two-part section: an `"ID:"` row (the
 * enrollment id follows the label, name/dept further along) and the row(s) beneath
 * it holding that employee's punches, aligned to the same day columns. A day's cell
 * concatenates every punch with no separator, each a fixed 5-char `HH:MM`
 * (`"04:2204:5606:2415:22"` = four punches). We split them, then take the earliest
 * as time-in and the latest as time-out.
 */

const LOG_SHEET_RE = /^attendance record report$/i;
const DAY_NUM_RE = /^\d{1,2}$/;

/** Split a concatenated punch cell (`"06:5915:48"`) into `HH:MM` times. */
function splitTimes(cell: unknown): string[] {
  if (typeof cell !== "string") return [];
  const s = cell.trim();
  const out: string[] = [];
  for (let i = 0; i + 5 <= s.length; i += 5) {
    const m = s.slice(i, i + 5).match(TIME_RE);
    if (m && Number(m[1]) <= 23) out.push(`${pad(Number(m[1]))}:${m[2]}`);
  }
  return out;
}

/** The "Att.log report" sheet is titled "Attendance Record Report" in cell A1. */
function findLogSheet(sheets: SheetGrid[]): SheetGrid | null {
  return (
    sheets.find((s) =>
      s.rows.some((row) =>
        row.some((c) => typeof c === "string" && LOG_SHEET_RE.test(c.trim())),
      ),
    ) ?? null
  );
}

/** Map column index → day number from the row of day headers (`"14"`…`"29"`). */
function findDayColumns(rows: unknown[][]): Map<number, number> | null {
  for (const row of rows) {
    const first = row[0];
    if (typeof first !== "string" || !DAY_NUM_RE.test(first.trim())) continue;
    const cols = new Map<number, number>();
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (typeof v === "string" && DAY_NUM_RE.test(v.trim())) {
        cols.set(c, Number(v.trim()));
      }
    }
    if (cols.size > 0) return cols;
  }
  return null;
}

/** The id is the first non-empty, non-label cell after the `"ID:"` marker. */
function readDeviceId(row: unknown[]): string | null {
  for (let c = 1; c < row.length; c++) {
    const v = row[c];
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== "Name:" && s !== "Dept.:") return s;
  }
  return null;
}

/** The name is the first non-empty cell after the `"Name:"` label on the id row. */
function readName(row: unknown[]): string | null {
  const at = row.findIndex(
    (v) => typeof v === "string" && v.trim() === "Name:",
  );
  if (at < 0) return null;
  for (let c = at + 1; c < row.length; c++) {
    const v = row[c];
    if (v == null) continue;
    const s = String(v).trim();
    if (s && s !== "Dept.:") return s;
  }
  return null;
}

function parse(sheets: SheetGrid[]): DailyRecord[] {
  const start = findPeriodStart(sheets);
  const log = findLogSheet(sheets);
  if (!start || !log) return [];

  const dayCols = findDayColumns(log.rows);
  if (!dayCols) return [];

  const records: DailyRecord[] = [];
  let deviceUserId: string | null = null;
  let deviceName: string | null = null;

  for (const row of log.rows) {
    const first = typeof row[0] === "string" ? row[0].trim() : row[0];
    if (first === "ID:") {
      deviceUserId = readDeviceId(row);
      deviceName = readName(row);
      continue;
    }
    if (!deviceUserId) continue;

    for (const [col, day] of dayCols) {
      const times = splitTimes(row[col]);
      if (times.length === 0) continue;
      times.sort();
      records.push({
        deviceUserId,
        deviceName,
        date: resolveDate(day, start),
        timeIn: times[0],
        timeOut: times.length > 1 ? times[times.length - 1] : null,
        raw: { sheet: log.name, day, punches: times },
      });
    }
  }
  return records;
}

export const zkteco: AttendanceAdapter = {
  format: "zkteco",
  label: "ZKTeco",
  parse,
};
