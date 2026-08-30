import "server-only";
import * as XLSX from "xlsx";
import {
  findAttendanceBranches,
  batchUpsertAttendanceRecords,
  deleteAttendanceRecord,
  deleteImportRow,
  findEmployeeDevice,
  findImportById,
  findImports,
  findRecordForDay,
  findRecordsForEmployee,
  findRecordsForRange,
  insertImport,
  manualUpsertAttendanceRecord,
  updateImportRow,
  upsertEmployeeDevice,
} from "@/server/db/attendance";
import { findBranchById } from "@/server/db/branches";
import { findEmployeeByCode } from "@/server/db/employees";
import { findEntriesForEmployee, findEntriesForRange } from "@/server/db/schedule";
import { auditLog } from "@/server/services/audit.service";
import { getAdapter } from "@/lib/attendance/adapters";
import type { SheetGrid } from "@/lib/attendance/adapters";
import { compareDay } from "@/lib/attendance/compare";
import { LATE_DEDUCTION_GRACE_MINUTES } from "@/lib/attendance/config";
import {
  BadRequestError,
  NotFoundError,
  toErrorMessage,
} from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type {
  AttendanceBranchOption,
  AttendanceComparisonRow,
  AttendanceImportRow,
  PayrollAttendanceSummary,
  UnmatchedDevice,
} from "@/lib/types/attendance";
import type {
  EditAttendanceSchema,
  MapDeviceSchema,
  UploadAttendanceSchema,
} from "@/lib/validations/attendance";
import type { Prisma } from "@/generated/prisma/client";

// ── Workbook reading (SheetJS — reads both .xls and .xlsx) ────────────────────

/**
 * Read every worksheet into dense array-of-arrays grids. Cells are kept as
 * strings (`raw: false`) so punch times like "07:16" stay text for the adapter.
 */
function readSheets(buffer: Buffer): SheetGrid[] {
  const wb = XLSX.read(buffer, { type: "buffer", raw: false });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      raw: false,
      defval: null,
    }) as unknown[][],
  }));
}

// ── Matching ─────────────────────────────────────────────────────────────────

/**
 * Resolve a scanner enrollment id to an employee. The scanners are configured so
 * the enrollment id equals the employee's `employeeCode`, so that's the primary
 * match. An explicit `EmployeeDevice` mapping (from the unmatched panel) takes
 * precedence, to cover any scanner whose id can't be aligned to the code.
 */
async function resolveEmployeeId(
  branchId: string,
  deviceUserId: string,
): Promise<string | null> {
  const override = await findEmployeeDevice(branchId, deviceUserId);
  if (override) return override.profileId;
  const employee = await findEmployeeByCode(deviceUserId);
  return employee?.id ?? null;
}

// ── Import lifecycle ─────────────────────────────────────────────────────────

/**
 * Register an upload and parse it. Parsing runs inline (biometric period exports
 * are small); `runImport` records the outcome on the import row, so a parse
 * failure surfaces as a "failed" import in the UI rather than a thrown action.
 */
export async function startImport(
  input: UploadAttendanceSchema,
  actor: Actor,
) {
  const branch = await findBranchById(input.branchId);
  if (!branch) throw new NotFoundError("Branch", input.branchId);
  if (!branch.attendanceFormat) {
    throw new BadRequestError(
      "This branch has no biometric format configured yet.",
    );
  }

  const imp = await insertImport({
    branchId: branch.id,
    format: branch.attendanceFormat,
    fileName: input.fileName,
    uploadedBy: actor.clerkUserId,
  });

  await auditLog({
    actor,
    action: "attendance.import.started",
    entityType: "attendance_import",
    entityId: imp.id,
    after: imp,
  });

  // Errors are recorded on the import row by runImport; don't fail the action.
  await runImport({
    importId: imp.id,
    branchId: branch.id,
    format: branch.attendanceFormat,
    fileBase64: input.fileBase64,
  }).catch(() => {});

  return imp;
}

/**
 * Parse an uploaded workbook, match rows to employees, and store normalized
 * attendance. Updates the import row with the outcome; unmatched device ids are
 * recorded for review (not an error).
 */
export async function runImport(params: {
  importId: string;
  branchId: string;
  format: string;
  fileBase64: string;
}) {
  const { importId, branchId, format, fileBase64 } = params;
  try {
    const buffer = Buffer.from(fileBase64, "base64");
    const sheets = readSheets(buffer);
    const records = getAdapter(format).parse(sheets);

    // Resolve each unique device id once (many day-rows share an id).
    const uniqueIds = [...new Set(records.map((r) => r.deviceUserId))];
    const resolvedEntries = await Promise.all(
      uniqueIds.map(async (id) => [id, await resolveEmployeeId(branchId, id)] as const),
    );
    const resolved = new Map(resolvedEntries);

    // deviceUserId → the name printed on the export (first non-null seen).
    const unmatched = new Map<string, string | null>();
    const toUpsert: Parameters<typeof batchUpsertAttendanceRecords>[0] = [];

    for (const rec of records) {
      const employeeId = resolved.get(rec.deviceUserId) ?? null;
      if (!employeeId) {
        if (!unmatched.has(rec.deviceUserId)) {
          unmatched.set(rec.deviceUserId, rec.deviceName);
        }
        continue;
      }
      toUpsert.push({
        importId,
        employeeId,
        branchId,
        date: new Date(`${rec.date}T00:00:00.000Z`),
        timeIn: rec.timeIn,
        timeOut: rec.timeOut,
        gapStart: rec.gapStart,
        gapEnd: rec.gapEnd,
        gap2Start: null,
        gap2End: null,
        breakMinutes: rec.breakMinutes,
        rawRow: structuredClone(rec.raw) as Prisma.InputJsonValue,
      });
    }

    // Single transaction: one round-trip for all records instead of N sequential awaits.
    await batchUpsertAttendanceRecords(toUpsert);
    const matched = toUpsert.length;

    const unmatchedIds = [...unmatched].map(([deviceUserId, name]) => ({
      deviceUserId,
      name,
    }));
    await updateImportRow(importId, {
      status: "completed",
      totalRows: records.length,
      matchedRows: matched,
      unmatchedRows: records.length - matched,
      unmatchedIds,
    });
    return { total: records.length, matched, unmatchedIds };
  } catch (err) {
    await updateImportRow(importId, {
      status: "failed",
      errorMessage: toErrorMessage(err),
    });
    throw err;
  }
}

// ── Device mapping ───────────────────────────────────────────────────────────

export async function mapDevice(input: MapDeviceSchema, actor: Actor) {
  const device = await upsertEmployeeDevice(input);
  await auditLog({
    actor,
    action: "attendance.device.mapped",
    entityType: "employee_device",
    entityId: device.id,
    after: device,
  });
  return device;
}

export async function deleteImport(id: string, actor: Actor) {
  const before = await findImportById(id);
  if (!before) throw new NotFoundError("Attendance import", id);
  await deleteImportRow(id);
  await auditLog({
    actor,
    action: "attendance.import.deleted",
    entityType: "attendance_import",
    entityId: id,
    before,
  });
}

// ── Manual editing ───────────────────────────────────────────────────────────

/**
 * Admin manual edit of one employee-day. Clearing both times removes the record;
 * otherwise the record is upserted as a `manual` override. The branch is carried
 * over from any existing record so the row stays branch-scoped.
 */
export async function editAttendanceRecord(
  input: EditAttendanceSchema,
  actor: Actor,
) {
  const date = new Date(`${input.date}T00:00:00.000Z`);
  const before = await findRecordForDay(input.employeeId, date);

  if (!input.timeIn && !input.timeOut) {
    if (!before) return; // nothing to clear
    await deleteAttendanceRecord(input.employeeId, date);
    await auditLog({
      actor,
      action: "attendance.record.cleared",
      entityType: "attendance_record",
      entityId: before.id,
      before,
    });
    return;
  }

  // Derive breakMinutes from the entered gap times.
  const { gapStart, gapEnd, gap2Start, gap2End } = input;
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const gapMinutes = (s: string | null | undefined, e: string | null | undefined): number | null => {
    if (s && e) return Math.max(0, toMin(e) - toMin(s));
    if (s ?? e) return null; // one side only → unresolved
    return 0;
  };
  const g1 = gapMinutes(gapStart, gapEnd);
  const g2 = gapMinutes(gap2Start, gap2End);
  const breakMinutes = g1 === null || g2 === null ? null : g1 + g2;

  const record = await manualUpsertAttendanceRecord({
    employeeId: input.employeeId,
    branchId: before?.branchId ?? null,
    date,
    timeIn: input.timeIn,
    timeOut: input.timeOut,
    gapStart: gapStart ?? null,
    gapEnd: gapEnd ?? null,
    gap2Start: gap2Start ?? null,
    gap2End: gap2End ?? null,
    breakMinutes,
    editedBy: actor.clerkUserId,
  });
  await auditLog({
    actor,
    action: "attendance.record.edited",
    entityType: "attendance_record",
    entityId: record.id,
    before,
    after: record,
  });
}

// ── Reads for the UI ─────────────────────────────────────────────────────────

const dateKey = (date: Date, employeeId: string) =>
  `${date.toISOString().slice(0, 10)}|${employeeId}`;

/** Schedule (target) vs attendance (actual) for a date range, one row per day. */
export async function getComparison(
  from: Date,
  to: Date,
): Promise<AttendanceComparisonRow[]> {
  const [entries, records] = await Promise.all([
    findEntriesForRange(from, to),
    findRecordsForRange(from, to),
  ]);
  const recByKey = new Map(
    records.map((r) => [dateKey(r.date, r.profileId), r]),
  );

  const rows: AttendanceComparisonRow[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const key = dateKey(entry.date, entry.profileId);
    seen.add(key);
    const rec = recByKey.get(key);
    const cmp = compareDay({
      startTime: entry.startTime,
      endTime: entry.endTime,
      timeIn: rec?.timeIn ?? null,
      timeOut: rec?.timeOut ?? null,
      breakMinutes: rec?.breakMinutes ?? null,
    });
    rows.push({
      date: entry.date.toISOString().slice(0, 10),
      employeeId: entry.profileId,
      employeeCode: entry.profile.employeeCode,
      employeeName: `${entry.profile.firstName} ${entry.profile.lastName}`,
      scheduledStart: entry.startTime,
      scheduledEnd: entry.endTime,
      actualIn: rec?.timeIn ?? null,
      actualOut: rec?.timeOut ?? null,
      gapStart: rec?.gapStart ?? null,
      gapEnd: rec?.gapEnd ?? null,
      gap2Start: rec?.gap2Start ?? null,
      gap2End: rec?.gap2End ?? null,
      source: (rec?.source as "biometric" | "manual" | undefined) ?? null,
      status: cmp.status,
      lateMinutes: cmp.lateMinutes,
      undertimeMinutes: cmp.undertimeMinutes,
      overtimeMinutes: cmp.overtimeMinutes,
      breakMinutes: cmp.breakMinutes,
      needsReview: cmp.needsReview,
    });
  }

  // Attendance with no schedule that day (e.g. worked on a day off) — surface it.
  for (const rec of records) {
    const key = dateKey(rec.date, rec.profileId);
    if (seen.has(key)) continue;
    rows.push({
      date: rec.date.toISOString().slice(0, 10),
      employeeId: rec.profileId,
      employeeCode: rec.profile.employeeCode,
      employeeName: `${rec.profile.firstName} ${rec.profile.lastName}`,
      scheduledStart: null,
      scheduledEnd: null,
      actualIn: rec.timeIn,
      actualOut: rec.timeOut,
      gapStart: rec.gapStart ?? null,
      gapEnd: rec.gapEnd ?? null,
      gap2Start: rec.gap2Start ?? null,
      gap2End: rec.gap2End ?? null,
      source: (rec.source as "biometric" | "manual" | undefined) ?? null,
      status: "no-schedule",
      lateMinutes: 0,
      undertimeMinutes: 0,
      overtimeMinutes: 0,
      breakMinutes: rec.breakMinutes ?? 0,
      needsReview: rec.timeIn !== null && rec.breakMinutes === null,
    });
  }

  rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.employeeName.localeCompare(b.employeeName),
  );
  return rows;
}

export async function getImports(): Promise<AttendanceImportRow[]> {
  const imps = await findImports();
  return imps.map((imp) => ({
    id: imp.id,
    branchId: imp.branchId,
    branchName: imp.branch.name,
    fileName: imp.fileName,
    format: imp.format,
    status: imp.status,
    totalRows: imp.totalRows,
    matchedRows: imp.matchedRows,
    unmatchedRows: imp.unmatchedRows,
    unmatched: Array.isArray(imp.unmatchedIds)
      ? (imp.unmatchedIds as unknown[]).map((u) =>
          typeof u === "string"
            ? { deviceUserId: u, name: null } // legacy rows stored bare ids
            : (u as UnmatchedDevice),
        )
      : [],
    errorMessage: imp.errorMessage,
    createdAt: imp.createdAt.toISOString(),
  }));
}

export async function getUploadBranches(): Promise<AttendanceBranchOption[]> {
  const branches = await findAttendanceBranches();
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    attendanceFormat: b.attendanceFormat as string,
  }));
}

/**
 * Roll one employee's schedule-vs-attendance up over a payroll period: days
 * worked, absences, and deductible late/undertime. `hasSchedule` is false when
 * the employee has no schedule in the period, so payroll can fall back to its
 * default working-days instead of paying zero.
 */
export async function summarizeForPayroll(
  employeeId: string,
  from: Date,
  to: Date,
  standardShiftMinutes: number,
): Promise<PayrollAttendanceSummary> {
  const [entries, records] = await Promise.all([
    findEntriesForEmployee(employeeId, from, to),
    findRecordsForEmployee(employeeId, from, to),
  ]);
  const recByDate = new Map(
    records.map((r) => [r.date.toISOString().slice(0, 10), r]),
  );

  let scheduledDays = 0;
  let daysWorked = 0;
  let absentDays = 0;
  let lateMinutes = 0;
  let undertimeMinutes = 0;
  let overtimeMinutes = 0;
  let scheduledMinutes = 0;
  let breakMinutes = 0;
  let deductionDays = 0;
  // Days worked keyed by the branch that recorded them, for per-branch gross pay.
  const daysByBranch = new Map<string | null, number>();

  for (const entry of entries) {
    scheduledDays++;
    const rec = recByDate.get(entry.date.toISOString().slice(0, 10));
    const cmp = compareDay({
      startTime: entry.startTime,
      endTime: entry.endTime,
      timeIn: rec?.timeIn ?? null,
      timeOut: rec?.timeOut ?? null,
      breakMinutes: rec?.breakMinutes ?? null,
    });
    if (cmp.status === "absent") {
      absentDays++;
      continue;
    }
    daysWorked++;
    // Attribute the day to the branch that recorded the punch; fall back to the
    // scheduled branch, else leave it unassigned (null).
    const branchId = rec?.branchId ?? entry.branchId ?? null;
    daysByBranch.set(branchId, (daysByBranch.get(branchId) ?? 0) + 1);
    // Charge late/undertime from the first minute (no grace) — pro-rated by the
    // shift length so it's a per-minute deduction of the daily rate.
    lateMinutes += cmp.lateMinutes;
    undertimeMinutes += cmp.undertimeMinutes;
    overtimeMinutes += cmp.overtimeMinutes;
    scheduledMinutes += cmp.scheduledMinutes;
    breakMinutes += cmp.breakMinutes;
    if (standardShiftMinutes > 0) {
      const effectiveLate = cmp.lateMinutes > LATE_DEDUCTION_GRACE_MINUTES ? cmp.lateMinutes : 0;
      deductionDays +=
        (effectiveLate + cmp.undertimeMinutes + cmp.breakMinutes) /
        standardShiftMinutes;
    }
  }

  return {
    hasSchedule: scheduledDays > 0,
    scheduledDays,
    daysWorked,
    absentDays,
    lateMinutes,
    undertimeMinutes,
    overtimeMinutes,
    scheduledMinutes,
    breakMinutes,
    deductionDays,
    byBranch: Array.from(daysByBranch, ([branchId, days]) => ({
      branchId,
      daysWorked: days,
    })),
  };
}
