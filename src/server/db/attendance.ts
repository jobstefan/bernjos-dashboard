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
  rawRow: Prisma.InputJsonValue;
}

/** Upsert one employee-day. A re-import for the same day overwrites the prior row. */
export function upsertAttendanceRecord(data: AttendanceRecordData) {
  const { date, employeeId, importId, branchId, timeIn, timeOut, rawRow } = data;
  return prisma.attendanceRecord.upsert({
    where: { date_employeeId: { date, employeeId } },
    create: { importId, employeeId, branchId, date, timeIn, timeOut, rawRow },
    // A fresh import supersedes any manual edit for the day: reset the source.
    update: {
      importId,
      branchId,
      timeIn,
      timeOut,
      rawRow,
      source: "biometric",
      editedBy: null,
      editedAt: null,
    },
  });
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
  editedBy: string;
}) {
  const { employeeId, branchId, date, timeIn, timeOut, editedBy } = data;
  const editedAt = new Date();
  return prisma.attendanceRecord.upsert({
    where: { date_employeeId: { date, employeeId } },
    create: {
      employeeId,
      branchId,
      date,
      timeIn,
      timeOut,
      source: "manual",
      editedBy,
      editedAt,
    },
    update: { branchId, timeIn, timeOut, source: "manual", editedBy, editedAt },
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
