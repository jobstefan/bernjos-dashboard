import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { AbsenceRequestStatus } from "@/generated/prisma/enums";

export interface AbsenceRequestFilters {
  status?: AbsenceRequestStatus;
  employeeId?: string;
  date?: Date;
}

const withEmployee = {
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  },
} satisfies Prisma.AbsenceRequestInclude;

function buildWhere(
  filters?: AbsenceRequestFilters,
): Prisma.AbsenceRequestWhereInput {
  const where: Prisma.AbsenceRequestWhereInput = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.employeeId) where.employeeId = filters.employeeId;
  if (filters?.date) where.date = filters.date;
  return where;
}

export function findAbsenceRequests(filters?: AbsenceRequestFilters) {
  return prisma.absenceRequest.findMany({
    where: buildWhere(filters),
    include: withEmployee,
    orderBy: [{ date: "asc" }, { createdAt: "desc" }],
  });
}

export function findAbsenceRequestsForEmployee(employeeId: string) {
  return prisma.absenceRequest.findMany({
    where: { employeeId },
    include: withEmployee,
    orderBy: { date: "asc" },
  });
}

export function findAbsenceRequestsForDate(date: Date) {
  return prisma.absenceRequest.findMany({
    where: { date },
    include: withEmployee,
  });
}

export function findAbsenceRequestById(id: string) {
  return prisma.absenceRequest.findFirst({
    where: { id },
    include: withEmployee,
  });
}

export function findAbsenceRequestByEmployeeDate(
  employeeId: string,
  date: Date,
) {
  return prisma.absenceRequest.findFirst({
    where: { employeeId, date },
    include: withEmployee,
  });
}

export function insertAbsenceRequest(data: Prisma.AbsenceRequestCreateInput) {
  return prisma.absenceRequest.create({ data, include: withEmployee });
}

export function updateAbsenceRequest(
  id: string,
  data: Prisma.AbsenceRequestUpdateInput,
) {
  return prisma.absenceRequest.update({
    where: { id },
    data,
    include: withEmployee,
  });
}

export function removeAbsenceRequest(id: string) {
  return prisma.absenceRequest.delete({ where: { id } });
}
