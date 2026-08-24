import { findPeriodStart, pad, resolveDate, summarizePunches, TIME_RE } from "./shared";
import type { PeriodStart, Punch } from "./shared";
import type { AttendanceAdapter, DailyRecord, SheetGrid } from "./types";

/**
 * Deli biometric "Employee Attendance Table" exports.
 *
 * These workbooks lay out three employees side-by-side per detail sheet in fixed
 * 15-column blocks. Each block has a header area (the enrollment id sits 8 columns
 * after an "ID"/"User ID" label) and a time-card grid: one row per day (`"14 Su"`)
 * with punches in fixed In/Out subcolumns. We read the four core punches — arrival,
 * mid-day gap start, mid-day gap end, departure — so a mid-day round trip is
 * captured as a real gap; a day whose punches don't pair up cleanly is flagged for
 * review. Overtime columns are ignored on purpose: overtime is reconciled against
 * the schedule feature, not from these punches.
 */

const DAY_RE = /^(\d{1,2})\s+[A-Za-z]{2,3}$/; // "14 Su"
/** The id label sits this many columns before the block's first (date) column. */
const ID_LABEL_OFFSET = 8;
const DEFAULT_BLOCK_WIDTH = 15;

/**
 * The four core punch subcolumns within a block, as `[offset from the date column,
 * role]`, in the order they occur through the day so the punches alternate
 * in→out→in→out:
 *   +1  Before Noon In  → arrival
 *   +3  Before Noon Out → mid-day gap start
 *   +6  After Noon In   → mid-day gap end
 *   +8  After Noon Out  → departure
 * The Overtime subcolumns (+10 In, +12 Out) are deliberately skipped.
 */
const PUNCH_COLUMNS: ReadonlyArray<readonly [number, Punch["role"]]> = [
  [1, "in"],
  [3, "out"],
  [6, "in"],
  [8, "out"],
];

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

      const punches: Punch[] = [];
      for (const [offset, role] of PUNCH_COLUMNS) {
        const col = block.start + offset;
        if (col >= end) break;
        const t = normalizeTime(row[col]);
        if (t) punches.push({ time: t, role });
      }
      if (punches.length === 0) continue; // no punches = didn't clock (absent/day off)

      const { timeIn, timeOut, gapStart, gapEnd, breakMinutes } = summarizePunches(punches);
      out.push({
        deviceUserId: block.deviceUserId,
        deviceName: block.deviceName,
        date: resolveDate(Number(dm[1]), start),
        timeIn,
        timeOut,
        gapStart,
        gapEnd,
        breakMinutes,
        raw: { sheet: sheet.name, day: dateCell, punches },
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
