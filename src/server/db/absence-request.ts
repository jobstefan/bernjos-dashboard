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
  if (filters?.date) where.date = filters.date;
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

export function findAbsenceRequestsForDate(date: Date) {
  return prisma.absenceRequest.findMany({
    where: { date },
    include: withProfile,
  });
}

export function findAbsenceRequestById(id: string) {
  return prisma.absenceRequest.findFirst({
    where: { id },
    include: withProfile,
  });
}

export function findAbsenceRequestByEmployeeDate(
  profileId: string,
  date: Date,
) {
  return prisma.absenceRequest.findFirst({
    where: { profileId, date },
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
