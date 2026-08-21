import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const withRelations = {
  employee: {
    select: { id: true, employeeCode: true, firstName: true, lastName: true },
  },
  branch: { select: { id: true, name: true } },
} satisfies Prisma.ScheduleEntryInclude;

export function findEntriesByDate(date: Date) {
  return prisma.scheduleEntry.findMany({
    where: { date },
    include: withRelations,
  });
}

export function findEntriesForEmployee(employeeId: string, from: Date, to: Date) {
  return prisma.scheduleEntry.findMany({
    where: { employeeId, date: { gte: from, lte: to } },
    include: withRelations,
    orderBy: { date: "asc" },
  });
}

/** Data for one working employee's entry on a given day. */
export interface DayEntryData {
  employeeId: string;
  branchId: string | null;
  startTime: string;
  endTime: string;
  note: string | null;
}

/**
 * Atomically replace a whole day's schedule: drop every existing row for the
 * date, then insert one row per working employee. Employees not in `entries`
 * end up with no row = day off.
 */
export function replaceDaySchedule(
  date: Date,
  entries: DayEntryData[],
  createdBy: string,
) {
  return prisma.$transaction([
    prisma.scheduleEntry.deleteMany({ where: { date } }),
    prisma.scheduleEntry.createMany({
      data: entries.map((e) => ({
        date,
        employeeId: e.employeeId,
        branchId: e.branchId,
        startTime: e.startTime,
        endTime: e.endTime,
        note: e.note,
        createdBy,
      })),
    }),
  ]);
}
