import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export function findPositionById(id: string) {
  return prisma.position.findFirst({ where: { id, deletedAt: null } });
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
