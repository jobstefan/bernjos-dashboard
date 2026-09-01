import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export function findPositionById(id: string) {
  return prisma.position.findFirst({ where: { id, deletedAt: null } });
}

export async function findPositionByNamesAndDept(
  positionName: string,
  departmentName: string,
): Promise<{ shiftHours: number } | null> {
  const result = await prisma.position.findFirst({
    where: {
      name: positionName,
      deletedAt: null,
      department: { name: departmentName, deletedAt: null },
    },
    select: { shiftHours: true },
  });
  return result;
}

export async function findPositionShiftsByKeys(
  keys: Array<{ position: string; department: string }>,
): Promise<Map<string, number>> {
  if (!keys.length) return new Map();
  const results = await prisma.position.findMany({
    where: {
      deletedAt: null,
      OR: keys.map((k) => ({
        name: k.position,
        department: { name: k.department, deletedAt: null },
      })),
    },
    select: {
      name: true,
      shiftHours: true,
      department: { select: { name: true } },
    },
  });
  return new Map(
    results.map((r) => [`${r.department.name}::${r.name}`, r.shiftHours]),
  );
}

export function insertPosition(data: Prisma.PositionCreateInput) {
  return prisma.position.create({ data });
}

export function updatePositionRow(
  id: string,
  data: Prisma.PositionUpdateInput,
) {
  return prisma.position.update({ where: { id }, data });
}

export function softDeletePosition(id: string) {
  return prisma.position.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
