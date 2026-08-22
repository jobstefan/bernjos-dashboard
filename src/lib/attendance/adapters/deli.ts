import { findPeriodStart, pad, resolveDate, TIME_RE } from "./shared";
import type { PeriodStart } from "./shared";
import type { AttendanceAdapter, DailyRecord, SheetGrid } from "./types";

/**
 * Deli biometric "Employee Attendance Table" exports.
 *
 * These workbooks lay out three employees side-by-side per detail sheet in fixed
 * 15-column blocks. Each block has a header area (the enrollment id sits 8 columns
 * after an "ID"/"User ID" label) and a time-card grid: one row per day (`"14 Su"`)
 * with punch times spread across the block's columns (`Before Noon`/`After Noon`/
 * `Overtime`, each with In/Out subcolumns). We read every punch on a day and take
 * the earliest as time-in and the latest as time-out — robust to how many columns
 * actually carry a punch.
 */

const DAY_RE = /^(\d{1,2})\s+[A-Za-z]{2,3}$/; // "14 Su"
/** The id label sits this many columns before the block's first (date) column. */
const ID_LABEL_OFFSET = 8;
const DEFAULT_BLOCK_WIDTH = 15;

/** Detail sheets carry a "Time Card" marker; summary sheets don't. */
function isDetailSheet(rows: unknown[][]): boolean {
  return rows.some((row) =>
    row.some((c) => typeof c === "string" && /^time card$/i.test(c.trim())),
  );
}

interface Block {
  start: number;
  deviceUserId: string;
  deviceName: string | null;
}

/**
 * Locate each employee block by its id label; dedupe by start column. The "Name"
 * label sits at the same block offset as the id label (both 8 columns before the
 * block's date column, on different header rows), so we key both by `start`.
 */
function findBlocks(rows: unknown[][]): Block[] {
  const idByStart = new Map<number, string>();
  const nameByStart = new Map<number, string>();
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const v = row[c];
      if (typeof v !== "string") continue;
      const label = v.trim();
      const start = c - ID_LABEL_OFFSET;
      if (start < 0) continue;
      const value = String(row[c + 1] ?? "").trim();
      if (!value) continue;
      if (/^(user id|id)$/i.test(label) && !idByStart.has(start)) {
        idByStart.set(start, value);
      } else if (/^name$/i.test(label) && !nameByStart.has(start)) {
        nameByStart.set(start, value);
      }
    }
  }
  return [...idByStart.entries()]
    .map(([start, deviceUserId]) => ({
      start,
      deviceUserId,
      deviceName: nameByStart.get(start) ?? null,
    }))
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
        deviceName: block.deviceName,
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

export const deli: AttendanceAdapter = {
  format: "deli",
  label: "Deli Biometric",
  parse,
};
