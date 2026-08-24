import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// ── Imports ──────────────────────────────────────────────────────────────────

export function insertImport(data: {
  branchId: string;
  format: string;
  fileName: string;
  uploadedBy: string;
}) {
  return prisma.attendanceImport.create({ data });
}

export function updateImportRow(
  id: string,
  data: Prisma.AttendanceImportUpdateInput,
) {
  return prisma.attendanceImport.update({ where: { id }, data });
}

export function findImportById(id: string) {
  return prisma.attendanceImport.findUnique({ where: { id } });
}

/** Delete an import; its attendance records cascade (onDelete: Cascade). */
export function deleteImportRow(id: string) {
  return prisma.attendanceImport.delete({ where: { id } });
}

export function findImports(branchId?: string) {
  return prisma.attendanceImport.findMany({
    where: branchId ? { branchId } : undefined,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

// ── Records ──────────────────────────────────────────────────────────────────

export interface AttendanceRecordData {
  importId: string;
  employeeId: string;
  branchId: string | null;
  date: Date;
  timeIn: string | null;
  timeOut: string | null;
  gapStart: string | null;
  gapEnd: string | null;
  gap2Start: string | null;
  gap2End: string | null;
  breakMinutes: number | null;
  rawRow: Prisma.InputJsonValue;
}

/** Upsert one employee-day. A re-import for the same day overwrites the prior row. */
export function upsertAttendanceRecord(data: AttendanceRecordData) {
  const { date, employeeId, importId, branchId, timeIn, timeOut, gapStart, gapEnd, gap2Start, gap2End, breakMinutes, rawRow } =
    data;
  return prisma.attendanceRecord.upsert({
    where: { date_employeeId: { date, employeeId } },
    create: {
      importId,
      employeeId,
      branchId,
      date,
      timeIn,
      timeOut,
      gapStart,
      gapEnd,
      gap2Start,
      gap2End,
      breakMinutes,
      rawRow,
    },
    update: {
      importId,
      branchId,
      timeIn,
      timeOut,
      gapStart,
      gapEnd,
      gap2Start,
      gap2End,
      breakMinutes,
      rawRow,
      source: "biometric",
      editedBy: null,
      editedAt: null,
    },
  });
}

/**
 * Bulk-upsert many employee-days using a single INSERT … ON CONFLICT DO UPDATE
 * statement — one round-trip regardless of record count. A re-import for the same
 * day overwrites the prior row (source reset to biometric, edits cleared).
 */
export async function batchUpsertAttendanceRecords(rows: AttendanceRecordData[]) {
  if (rows.length === 0) return;

  const now = new Date();
  const params: unknown[] = [];
  const placeholders: string[] = [];

  for (const row of rows) {
    const b = params.length; // base index (0-based; SQL params are 1-based)
    params.push(
      row.importId,              // b+1  import_id
      row.employeeId,            // b+2  employee_id
      row.branchId,              // b+3  branch_id
      row.date,                  // b+4  date
      row.timeIn,                // b+5  time_in
      row.timeOut,               // b+6  time_out
      row.gapStart,              // b+7  gap_start
      row.gapEnd,                // b+8  gap_end
      row.gap2Start,             // b+9  gap2_start
      row.gap2End,               // b+10 gap2_end
      row.breakMinutes,          // b+11 break_minutes
      JSON.stringify(row.rawRow),// b+12 raw_row (cast to jsonb in SQL)
      now,                       // b+13 created_at / updated_at
    );
    const n = (offset: number) => `$${b + offset}`;
    placeholders.push(
      `(gen_random_uuid()::text,${n(1)},${n(2)},${n(3)},${n(4)},${n(5)},${n(6)},${n(7)},${n(8)},${n(9)},${n(10)},${n(11)},${n(12)}::jsonb,'biometric',${n(13)},${n(13)})`,
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO attendance_records
       (id,import_id,employee_id,branch_id,date,time_in,time_out,
        gap_start,gap_end,gap2_start,gap2_end,break_minutes,raw_row,
        source,created_at,updated_at)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (date,employee_id) DO UPDATE SET
       import_id     = EXCLUDED.import_id,
       branch_id     = EXCLUDED.branch_id,
       time_in       = EXCLUDED.time_in,
       time_out      = EXCLUDED.time_out,
       gap_start     = EXCLUDED.gap_start,
       gap_end       = EXCLUDED.gap_end,
       gap2_start    = EXCLUDED.gap2_start,
       gap2_end      = EXCLUDED.gap2_end,
       break_minutes = EXCLUDED.break_minutes,
       raw_row       = EXCLUDED.raw_row,
       source        = 'biometric',
       edited_by     = NULL,
       edited_at     = NULL,
       updated_at    = EXCLUDED.updated_at`,
    ...params,
  );
}

/**
 * Admin manual edit of one employee-day. Sets `source: "manual"` and records the
 * editor. On update it keeps the existing `importId`/`rawRow` (so correcting a
 * biometric row stays linked to its import); on create there is no import.
 */
export function manualUpsertAttendanceRecord(data: {
  employeeId: string;
  branchId: string | null;
  date: Date;
  timeIn: string | null;
  timeOut: string | null;
  gapStart: string | null;
  gapEnd: string | null;
  gap2Start: string | null;
  gap2End: string | null;
  breakMinutes: number | null;
  editedBy: string;
}) {
  const { employeeId, branchId, date, timeIn, timeOut, gapStart, gapEnd, gap2Start, gap2End, breakMinutes, editedBy } =
    data;
  const editedAt = new Date();
  return prisma.attendanceRecord.upsert({
    where: { date_employeeId: { date, employeeId } },
    create: {
      employeeId,
      branchId,
      date,
      timeIn,
      timeOut,
      gapStart,
      gapEnd,
      gap2Start,
      gap2End,
      breakMinutes,
      source: "manual",
      editedBy,
      editedAt,
    },
    update: {
      branchId,
      timeIn,
      timeOut,
      gapStart,
      gapEnd,
      gap2Start,
      gap2End,
      breakMinutes,
      source: "manual",
      editedBy,
      editedAt,
    },
  });
}

/** One employee's record for a single day, or null. */
export function findRecordForDay(employeeId: string, date: Date) {
  return prisma.attendanceRecord.findUnique({
    where: { date_employeeId: { date, employeeId } },
  });
}

/** Remove an employee-day record (admin "clear" action). No-op if absent. */
export function deleteAttendanceRecord(employeeId: string, date: Date) {
  return prisma.attendanceRecord.deleteMany({
    where: { date, employeeId },
  });
}

const recordWithEmployee = {
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  },
} satisfies Prisma.AttendanceRecordInclude;

export function findRecordsForRange(from: Date, to: Date) {
  return prisma.attendanceRecord.findMany({
    where: { date: { gte: from, lte: to } },
    include: recordWithEmployee,
    orderBy: { date: "asc" },
  });
}

/** One employee's attendance rows across a range (for payroll aggregation). */
export function findRecordsForEmployee(employeeId: string, from: Date, to: Date) {
  return prisma.attendanceRecord.findMany({
    where: { employeeId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
  });
}

// ── Device mappings ──────────────────────────────────────────────────────────

export function findEmployeeDevice(branchId: string, deviceUserId: string) {
  return prisma.employeeDevice.findUnique({
    where: { branchId_deviceUserId: { branchId, deviceUserId } },
  });
}

/** Create or update the mapping for a (branch, device id) so it stays editable. */
export function upsertEmployeeDevice(data: {
  employeeId: string;
  branchId: string;
  deviceUserId: string;
}) {
  return prisma.employeeDevice.upsert({
    where: {
      branchId_deviceUserId: {
        branchId: data.branchId,
        deviceUserId: data.deviceUserId,
      },
    },
    create: data,
    update: { employeeId: data.employeeId },
  });
}

// ── Branches configured for attendance uploads ───────────────────────────────

/** Branches that have a biometric format set (i.e. can accept uploads). */
export function findAttendanceBranches() {
  return prisma.branch.findMany({
    where: { deletedAt: null, attendanceFormat: { not: null } },
    select: { id: true, name: true, attendanceFormat: true },
    orderBy: { name: "asc" },
  });
}
