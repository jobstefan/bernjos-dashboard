import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export function findBranches() {
  return prisma.branch.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export function findBranchById(id: string) {
  return prisma.branch.findFirst({ where: { id, deletedAt: null } });
}

export function insertBranch(data: Prisma.BranchCreateInput) {
  return prisma.branch.create({ data });
}

export function updateBranchRow(id: string, data: Prisma.BranchUpdateInput) {
  return prisma.branch.update({ where: { id }, data });
}

export function softDeleteBranch(id: string) {
  return prisma.branch.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
