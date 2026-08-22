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
    update: { importId, branchId, timeIn, timeOut, rawRow },
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
