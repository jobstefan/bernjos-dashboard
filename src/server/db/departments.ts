import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/** All live departments with their live (non-deleted) positions attached. */
export function findDepartmentsWithPositions() {
  return prisma.department.findMany({
    where: { deletedAt: null },
    include: {
      positions: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

export function findDepartmentById(id: string) {
  return prisma.department.findFirst({ where: { id, deletedAt: null } });
}

export function findDepartmentByName(name: string) {
  return prisma.department.findFirst({ where: { name, deletedAt: null } });
}

export async function findDepartmentShiftsByNames(
  names: string[],
): Promise<Map<string, number>> {
  if (!names.length) return new Map();
  const depts = await prisma.department.findMany({
    where: { name: { in: names }, deletedAt: null },
    select: { name: true, shiftHours: true },
  });
  return new Map(depts.map((d) => [d.name, d.shiftHours]));
}

export function insertDepartment(data: Prisma.DepartmentCreateInput) {
  return prisma.department.create({ data });
}

export function updateDepartmentRow(
  id: string,
  data: Prisma.DepartmentUpdateInput,
) {
  return prisma.department.update({ where: { id }, data });
}

export function softDeleteDepartment(id: string) {
  return prisma.department.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/** Soft-delete every live position under a department (used on department delete). */
export function softDeletePositionsForDepartment(departmentId: string) {
  return prisma.position.updateMany({
    where: { departmentId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
