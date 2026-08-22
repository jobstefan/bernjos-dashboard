import "server-only";
import * as XLSX from "xlsx";
import {
  findAttendanceBranches,
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
  upsertAttendanceRecord,
  upsertEmployeeDevice,
} from "@/server/db/attendance";
import { findBranchById } from "@/server/db/branches";
import { findEmployeeByCode } from "@/server/db/employees";
import { findEntriesForEmployee, findEntriesForRange } from "@/server/db/schedule";
import { auditLog } from "@/server/services/audit.service";
import { getAdapter } from "@/lib/attendance/adapters";
import type { SheetGrid } from "@/lib/attendance/adapters";
import { compareDay } from "@/lib/attendance/compare";
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
  if (override) return override.employeeId;
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

    let matched = 0;
    // deviceUserId → the name printed on the export (first non-null seen).
    const unmatched = new Map<string, string | null>();
    // Resolve each device id once per run (many day-rows share an id).
    const resolved = new Map<string, string | null>();

    for (const rec of records) {
      let employeeId = resolved.get(rec.deviceUserId);
      if (employeeId === undefined) {
        employeeId = await resolveEmployeeId(branchId, rec.deviceUserId);
        resolved.set(rec.deviceUserId, employeeId);
      }
      if (!employeeId) {
        if (!unmatched.get(rec.deviceUserId)) {
          unmatched.set(rec.deviceUserId, rec.deviceName);
        }
        continue;
      }
      await upsertAttendanceRecord({
        importId,
        employeeId,
        branchId,
        date: new Date(`${rec.date}T00:00:00.000Z`),
        timeIn: rec.timeIn,
        timeOut: rec.timeOut,
        // Deep-clone the raw row before storing it in the Json column.
        rawRow: structuredClone(rec.raw) as Prisma.InputJsonValue,
      });
      matched++;
    }

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

  const record = await manualUpsertAttendanceRecord({
    employeeId: input.employeeId,
    branchId: before?.branchId ?? null,
    date,
    timeIn: input.timeIn,
    timeOut: input.timeOut,
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
    records.map((r) => [dateKey(r.date, r.employeeId), r]),
  );

  const rows: AttendanceComparisonRow[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const key = dateKey(entry.date, entry.employeeId);
    seen.add(key);
    const rec = recByKey.get(key);
    const cmp = compareDay({
      startTime: entry.startTime,
      endTime: entry.endTime,
      timeIn: rec?.timeIn ?? null,
      timeOut: rec?.timeOut ?? null,
    });
    rows.push({
      date: entry.date.toISOString().slice(0, 10),
      employeeId: entry.employeeId,
      employeeCode: entry.employee.employeeCode,
      employeeName: `${entry.employee.firstName} ${entry.employee.lastName}`,
      scheduledStart: entry.startTime,
      scheduledEnd: entry.endTime,
      actualIn: rec?.timeIn ?? null,
      actualOut: rec?.timeOut ?? null,
      source: (rec?.source as "biometric" | "manual" | undefined) ?? null,
      status: cmp.status,
      lateMinutes: cmp.lateMinutes,
      undertimeMinutes: cmp.undertimeMinutes,
    });
  }

  // Attendance with no schedule that day (e.g. worked on a day off) — surface it.
  for (const rec of records) {
    const key = dateKey(rec.date, rec.employeeId);
    if (seen.has(key)) continue;
    rows.push({
      date: rec.date.toISOString().slice(0, 10),
      employeeId: rec.employeeId,
      employeeCode: rec.employee.employeeCode,
      employeeName: `${rec.employee.firstName} ${rec.employee.lastName}`,
      scheduledStart: null,
      scheduledEnd: null,
      actualIn: rec.timeIn,
      actualOut: rec.timeOut,
      source: (rec.source as "biometric" | "manual" | undefined) ?? null,
      status: "no-schedule",
      lateMinutes: 0,
      undertimeMinutes: 0,
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
    if (cmp.scheduledMinutes > 0) {
      deductionDays +=
        (cmp.lateMinutes + cmp.undertimeMinutes) / cmp.scheduledMinutes;
    }
  }

  return {
    hasSchedule: scheduledDays > 0,
    scheduledDays,
    daysWorked,
    absentDays,
    lateMinutes,
    undertimeMinutes,
    deductionDays,
    byBranch: Array.from(daysByBranch, ([branchId, days]) => ({
      branchId,
      daysWorked: days,
    })),
  };
}
