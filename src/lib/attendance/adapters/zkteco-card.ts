import type { AttendanceAdapter, DailyRecord, SheetGrid } from "./types";

/**
 * ZKTeco "Employee Attendance Table" / "Card Report" exports.
 *
 * These workbooks lay out three employees side-by-side per detail sheet in fixed
 * 15-column blocks. Each block has a header area (the enrollment id sits 8 columns
 * after an "ID"/"User ID" label) and a time-card grid: one row per day (`"14 Su"` /
 * `"14 SUN"`) with punch times in the block's columns. We read every punch on a
 * day and take the earliest as time-in and the latest as time-out — robust to the
 * On/Off/Overtime column variations across firmware versions.
 *
 * The same parser covers both branch variants we've seen; only labels differ
 * (`User ID`/`ID`, `Time Card`/`Att. Report`, `14 Su`/`14 SUN`).
 */

const pad = (n: number) => String(n).padStart(2, "0");
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const DAY_RE = /^(\d{1,2})\s+[A-Za-z]{2,3}$/; // "14 Su" / "14 SUN"
/** The id label sits this many columns before the block's first (date) column. */
const ID_LABEL_OFFSET = 8;
const DEFAULT_BLOCK_WIDTH = 15;

interface PeriodStart {
  year: number;
  month: number;
  day: number;
}

/** Find the period's first date from any header cell (handles both date orders). */
function findPeriodStart(sheets: SheetGrid[]): PeriodStart | null {
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
function resolveDate(day: number, start: PeriodStart): string {
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

/** Detail sheets carry a "Time Card" / "Att. Report" marker; others don't. */
function isDetailSheet(rows: unknown[][]): boolean {
  return rows.some((row) =>
    row.some(
      (c) => typeof c === "string" && /^(time card|att\. report)$/i.test(c.trim()),
    ),
  );
}

interface Block {
  start: number;
  deviceUserId: string;
}

/** Locate each employee block by its id label; dedupe by start column. */
function findBlocks(rows: unknown[][]): Block[] {
  const byStart = new Map<number, string>();
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (typeof v === "string" && /^(user id|id)$/i.test(v.trim())) {
        const id = String(row[c + 1] ?? "").trim();
        const start = c - ID_LABEL_OFFSET;
        if (id && start >= 0 && !byStart.has(start)) byStart.set(start, id);
      }
    }
  }
  return [...byStart.entries()]
    .map(([start, deviceUserId]) => ({ start, deviceUserId }))
    .sort((a, b) => a.start - b.start);
}

function normalizeTime(cell: unknown): string | null {
  if (typeof cell !== "string") return null;
  const m = cell.trim().match(TIME_RE);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return `${pad(h)}:${m[2]}`;
}

function parseSheet(
  sheet: SheetGrid,
  start: PeriodStart,
  maxCols: number,
): DailyRecord[] {
  const blocks = findBlocks(sheet.rows);
  const out: DailyRecord[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const end = i + 1 < blocks.length ? blocks[i + 1].start : maxCols;

    for (const row of sheet.rows) {
      const dateCell = row[block.start];
      const dm = typeof dateCell === "string" && dateCell.match(DAY_RE);
      if (!dm) continue;

      const times: string[] = [];
      for (let c = block.start + 1; c < end; c++) {
        const t = normalizeTime(row[c]);
        if (t) times.push(t);
      }
      if (times.length === 0) continue; // no punches = didn't clock (absent/day off)

      times.sort();
      out.push({
        deviceUserId: block.deviceUserId,
        date: resolveDate(Number(dm[1]), start),
        timeIn: times[0],
        timeOut: times.length > 1 ? times[times.length - 1] : null,
        raw: { sheet: sheet.name, day: dateCell, punches: times },
      });
    }
  }
  return out;
}

function parse(sheets: SheetGrid[]): DailyRecord[] {
  const start = findPeriodStart(sheets);
  if (!start) return [];

  const records: DailyRecord[] = [];
  for (const sheet of sheets) {
    if (!isDetailSheet(sheet.rows)) continue;
    const maxCols = sheet.rows.reduce(
      (m, r) => Math.max(m, r.length),
      DEFAULT_BLOCK_WIDTH,
    );
    records.push(...parseSheet(sheet, start, maxCols));
  }
  return records;
}

export const zktecoCard: AttendanceAdapter = {
  format: "zkteco-card",
  label: "ZKTeco Attendance Card",
  parse,
};
