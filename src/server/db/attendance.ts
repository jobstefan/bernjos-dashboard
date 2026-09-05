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

/** Upsert one profile-day. A re-import for the same day overwrites the prior row. */
export function upsertAttendanceRecord(data: AttendanceRecordData) {
  const { date, employeeId: profileId, importId, branchId, timeIn, timeOut, gapStart, gapEnd, gap2Start, gap2End, breakMinutes, rawRow } =
    data;
  return prisma.attendanceRecord.upsert({
    where: { date_profileId: { date, profileId } },
    create: {
      importId,
      profileId,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Bulk-upsert many profile-days. When a new import row lands on a day the
 * employee already has a biometric record from a *different* branch, the import
 * is treated as a mid-day branch transfer: the two time ranges are merged into
 * the parent record and a pair of AttendanceRecordBranch segments is created so
 * payroll can split the day proportionally. Same-branch re-imports still overwrite
 * via the fast SQL path; manual records are never touched.
 */
export async function batchUpsertAttendanceRecords(rows: AttendanceRecordData[]) {
  if (rows.length === 0) return;

  // Pre-fetch existing biometric records for the same (date, profile) pairs so we
  // can detect transfers before running the batch SQL.
  const existingRecords = await prisma.attendanceRecord.findMany({
    where: {
      OR: rows.map((r) => ({ date: r.date, profileId: r.employeeId })),
      source: { not: "manual" },
    },
    include: { branchSegments: true },
  });

  const existingMap = new Map(
    existingRecords.map((r) => [
      `${r.date.toISOString().slice(0, 10)}|${r.profileId}`,
      r,
    ]),
  );

  const normalRows: AttendanceRecordData[] = [];
  const transferCases: {
    existing: (typeof existingRecords)[0];
    incoming: AttendanceRecordData;
  }[] = [];

  for (const row of rows) {
    const key = `${row.date.toISOString().slice(0, 10)}|${row.employeeId}`;
    const existing = existingMap.get(key);
    if (existing && existing.branchId !== row.branchId && existing.timeIn && row.timeIn) {
      transferCases.push({ existing, incoming: row });
    } else {
      normalRows.push(row);
    }
  }

  // Fast SQL batch for non-transfer rows.
  if (normalRows.length > 0) {
    await batchUpsertNormal(normalRows);
  }

  // Merge transfer rows one-by-one (rare, so individual queries are acceptable).
  for (const { existing, incoming } of transferCases) {
    await mergeTransferRecord(existing, incoming);
  }
}

async function batchUpsertNormal(rows: AttendanceRecordData[]) {
  const now = new Date();
  const params: unknown[] = [];
  const placeholders: string[] = [];

  for (const row of rows) {
    const b = params.length; // base index (0-based; SQL params are 1-based)
    params.push(
      row.importId,              // b+1  import_id
      row.employeeId,            // b+2  profile_id
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
       (id,import_id,profile_id,branch_id,date,time_in,time_out,
        gap_start,gap_end,gap2_start,gap2_end,break_minutes,raw_row,
        source,created_at,updated_at)
     VALUES ${placeholders.join(",")}
     ON CONFLICT (date,profile_id) DO UPDATE SET
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
       updated_at    = EXCLUDED.updated_at
     WHERE attendance_records.source IS DISTINCT FROM 'manual'`,
    ...params,
  );
}

/** Merge two biometric records from different branches into one record + segments. */
async function mergeTransferRecord(
  existing: {
    id: string;
    branchId: string | null;
    timeIn: string | null;
    timeOut: string | null;
  },
  incoming: AttendanceRecordData,
) {
  // Build two segments ordered chronologically.
  const seg1 = {
    branchId: existing.branchId,
    timeFrom: existing.timeIn!,
    timeTo: existing.timeOut ?? incoming.timeIn ?? existing.timeIn!,
    minutes: 0,
  };
  const seg2 = {
    branchId: incoming.branchId,
    timeFrom: incoming.timeIn!,
    timeTo: incoming.timeOut ?? incoming.timeIn!,
    minutes: 0,
  };

  const ordered =
    toMin(seg1.timeFrom) <= toMin(seg2.timeFrom) ? [seg1, seg2] : [seg2, seg1];

  ordered.forEach((s) => {
    s.minutes = Math.max(0, toMin(s.timeTo) - toMin(s.timeFrom));
  });

  const mergedTimeIn = ordered[0].timeFrom;
  const mergedTimeOut = ordered[1].timeTo;
  const gapStart = ordered[0].timeTo;
  const gapEnd = ordered[1].timeFrom;
  const interBranchGap = Math.max(0, toMin(gapEnd) - toMin(gapStart));

  await prisma.$transaction(async (tx) => {
    await tx.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        branchId: ordered[0].branchId,
        timeIn: mergedTimeIn,
        timeOut: mergedTimeOut,
        gapStart,
        gapEnd,
        breakMinutes: interBranchGap,
        source: "biometric",
        editedBy: null,
        editedAt: null,
        updatedAt: new Date(),
      },
    });
    await tx.attendanceRecordBranch.deleteMany({ where: { recordId: existing.id } });
    await tx.attendanceRecordBranch.createMany({
      data: ordered.map((s) => ({
        recordId: existing.id,
        branchId: s.branchId,
        timeFrom: s.timeFrom,
        timeTo: s.timeTo,
        minutes: s.minutes,
      })),
    });
  });
}

/**
 * Replace all branch segments for a record. Pass an empty array to clear them
 * (i.e. the transfer was removed on manual edit).
 */
export async function replaceRecordBranchSegments(
  recordId: string,
  segments: { branchId: string | null; timeFrom: string; timeTo: string; minutes: number }[],
) {
  return prisma.$transaction(async (tx) => {
    await tx.attendanceRecordBranch.deleteMany({ where: { recordId } });
    if (segments.length > 0) {
      await tx.attendanceRecordBranch.createMany({
        data: segments.map((s) => ({ recordId, ...s })),
      });
    }
  });
}

/**
 * Admin manual edit of one profile-day. Sets `source: "manual"` and records the
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
  const { employeeId: profileId, branchId, date, timeIn, timeOut, gapStart, gapEnd, gap2Start, gap2End, breakMinutes, editedBy } =
    data;
  const editedAt = new Date();
  return prisma.attendanceRecord.upsert({
    where: { date_profileId: { date, profileId } },
    create: {
      profileId,
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

/** One profile's record for a single day, or null. */
export function findRecordForDay(employeeId: string, date: Date) {
  return prisma.attendanceRecord.findUnique({
    where: { date_profileId: { date, profileId: employeeId } },
    include: {
      branchSegments: {
        orderBy: { timeFrom: "asc" },
      },
    },
  });
}

/** Remove a profile-day record (admin "clear" action). No-op if absent. */
export function deleteAttendanceRecord(employeeId: string, date: Date) {
  return prisma.attendanceRecord.deleteMany({
    where: { date, profileId: employeeId },
  });
}

const recordWithProfile = {
  profile: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  },
} satisfies Prisma.AttendanceRecordInclude;

const branchSegmentsInclude = {
  branchSegments: {
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { timeFrom: "asc" as const },
  },
} satisfies Prisma.AttendanceRecordInclude;

export function findRecordsForRange(from: Date, to: Date) {
  return prisma.attendanceRecord.findMany({
    where: { date: { gte: from, lte: to } },
    include: { ...recordWithProfile, ...branchSegmentsInclude },
    orderBy: { date: "asc" },
  });
}

/** One profile's attendance rows across a range (for payroll aggregation). */
export function findRecordsForEmployee(profileId: string, from: Date, to: Date) {
  return prisma.attendanceRecord.findMany({
    where: { profileId, date: { gte: from, lte: to } },
    include: branchSegmentsInclude,
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
    create: { profileId: data.employeeId, branchId: data.branchId, deviceUserId: data.deviceUserId },
    update: { profileId: data.employeeId },
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
