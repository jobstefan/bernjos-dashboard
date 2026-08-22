import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { PeriodFilters } from "@/lib/types/payroll";

export function findPeriods(filters?: PeriodFilters) {
  const where: Prisma.PayrollPeriodWhereInput = { deletedAt: null };
  if (filters?.status) where.status = filters.status;
  return prisma.payrollPeriod.findMany({
    where,
    orderBy: { periodStart: "desc" },
    include: {
      _count: { select: { runItems: true } },
      runItems: {
        where: { deletedAt: null, status: "included" },
        select: { netPay: true },
      },
    },
  });
}

export function findPeriodById(id: string) {
  return prisma.payrollPeriod.findFirst({ where: { id, deletedAt: null } });
}

/** Any non-deleted period whose date range overlaps [start, end] with same frequency. */
export function findOverlappingPeriod(
  start: Date,
  end: Date,
  frequency: "semi_monthly" | "monthly",
  excludeId?: string,
) {
  return prisma.payrollPeriod.findFirst({
    where: {
      deletedAt: null,
      frequency,
      id: excludeId ? { not: excludeId } : undefined,
      periodStart: { lte: end },
      periodEnd: { gte: start },
    },
  });
}

export function insertPeriod(data: Prisma.PayrollPeriodCreateInput) {
  return prisma.payrollPeriod.create({ data });
}

export function updatePeriod(id: string, data: Prisma.PayrollPeriodUpdateInput) {
  return prisma.payrollPeriod.update({ where: { id }, data });
}

export function findRunItems(periodId: string) {
  return prisma.payrollRunItem.findMany({
    where: { payrollPeriodId: periodId, deletedAt: null },
    include: { employee: true },
    orderBy: { employee: { lastName: "asc" } },
  });
}

export function findRunItem(periodId: string, employeeId: string) {
  return prisma.payrollRunItem.findFirst({
    where: { payrollPeriodId: periodId, employeeId, deletedAt: null },
    include: { employee: true, period: true },
  });
}

export function findRunItemById(id: string) {
  return prisma.payrollRunItem.findFirst({
    where: { id, deletedAt: null },
    include: { employee: true, period: true },
  });
}

export function updateRunItem(id: string, data: Prisma.PayrollRunItemUpdateInput) {
  return prisma.payrollRunItem.update({ where: { id }, data });
}

export function findRunItemsForEmployee(employeeId: string) {
  return prisma.payrollRunItem.findMany({
    where: {
      employeeId,
      deletedAt: null,
      period: { deletedAt: null },
    },
    include: { employee: true, period: true },
    orderBy: { period: { periodStart: "desc" } },
  });
}

/** Delete existing (non-approved) run items for a period, e.g. before recalculating. */
export function deleteRunItemsForPeriod(periodId: string) {
  return prisma.payrollRunItem.deleteMany({
    where: { payrollPeriodId: periodId },
  });
}

export function insertRunItems(data: Prisma.PayrollRunItemCreateManyInput[]) {
  return prisma.payrollRunItem.createMany({ data });
}
