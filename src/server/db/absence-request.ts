import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { AbsenceRequestStatus } from "@/generated/prisma/enums";

export interface AbsenceRequestFilters {
  status?: AbsenceRequestStatus;
  employeeId?: string;
  date?: Date;
}

const withProfile = {
  profile: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  },
} satisfies Prisma.AbsenceRequestInclude;

function buildWhere(
  filters?: AbsenceRequestFilters,
): Prisma.AbsenceRequestWhereInput {
  const where: Prisma.AbsenceRequestWhereInput = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.employeeId) where.profileId = filters.employeeId;
  if (filters?.date) {
    // Match any request whose range covers this date
    const d = filters.date;
    where.OR = [
      { date: d, endDate: null },
      { date: { lte: d }, endDate: { gte: d } },
    ];
  }
  return where;
}

export function findAbsenceRequests(filters?: AbsenceRequestFilters) {
  return prisma.absenceRequest.findMany({
    where: buildWhere(filters),
    include: withProfile,
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
  });
}

export function findAbsenceRequestsForEmployee(profileId: string) {
  return prisma.absenceRequest.findMany({
    where: { profileId },
    include: withProfile,
    orderBy: { date: "asc" },
  });
}

export function findAbsenceRequestsInRange(from: Date, to: Date) {
  return prisma.absenceRequest.findMany({
    where: {
      date: { lte: to },
      OR: [
        { endDate: { gte: from } },
        { endDate: null, date: { gte: from } },
      ],
    },
    include: withProfile,
    orderBy: { date: "asc" },
  });
}

export function findAbsenceRequestsForDate(date: Date) {
  return prisma.absenceRequest.findMany({
    where: {
      OR: [
        { date, endDate: null },
        { date: { lte: date }, endDate: { gte: date } },
      ],
    },
    include: withProfile,
  });
}

export function findAbsenceRequestById(id: string) {
  return prisma.absenceRequest.findFirst({
    where: { id },
    include: withProfile,
  });
}

/**
 * Find any non-declined absence request for a profile whose date range
 * overlaps with [startDate, endDate]. Pass excludeId to skip one record
 * (used when re-checking after an edit, to exclude the record being updated).
 */
export function findOverlappingAbsenceRequest(
  profileId: string,
  startDate: Date,
  endDate: Date,
  excludeId?: string,
) {
  return prisma.absenceRequest.findFirst({
    where: {
      profileId,
      status: { in: ["pending", "approved"] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      date: { lte: endDate },
      OR: [
        { endDate: { gte: startDate } },
        { endDate: null, date: { gte: startDate } },
      ],
    },
    include: withProfile,
  });
}

export function insertAbsenceRequest(data: Prisma.AbsenceRequestCreateInput) {
  return prisma.absenceRequest.create({ data, include: withProfile });
}

export function updateAbsenceRequest(
  id: string,
  data: Prisma.AbsenceRequestUpdateInput,
) {
  return prisma.absenceRequest.update({
    where: { id },
    data,
    include: withProfile,
  });
}

export function removeAbsenceRequest(id: string) {
  return prisma.absenceRequest.delete({ where: { id } });
}
