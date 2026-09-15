import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const withRelations = {
  sourceBranch: { select: { id: true, name: true } },
  destBranch: { select: { id: true, name: true } },
  lines: {
    include: { product: { select: { name: true, unit: true } } },
    orderBy: { product: { name: "asc" as const } },
  },
} satisfies Prisma.StockTransferInclude;

export function findTransferById(id: string) {
  return prisma.stockTransfer.findUnique({ where: { id }, include: withRelations });
}

/** Transfers touching a branch (either side), newest first. */
export function findTransfersForBranch(branchId: string) {
  return prisma.stockTransfer.findMany({
    where: { OR: [{ sourceBranchId: branchId }, { destBranchId: branchId }] },
    include: withRelations,
    orderBy: { requestedAt: "desc" },
  });
}

export function findAllTransfers() {
  return prisma.stockTransfer.findMany({ include: withRelations, orderBy: { requestedAt: "desc" } });
}

export function insertTransfer(
  sourceBranchId: string,
  destBranchId: string,
  requestedBy: string,
  lines: { productId: string; requestedQty: number }[],
) {
  return prisma.stockTransfer.create({
    data: {
      sourceBranchId,
      destBranchId,
      requestedBy,
      lines: { create: lines.map((l) => ({ productId: l.productId, requestedQty: l.requestedQty })) },
    },
    include: withRelations,
  });
}

export function updateTransfer(id: string, data: Prisma.StockTransferUpdateInput) {
  return prisma.stockTransfer.update({ where: { id }, data, include: withRelations });
}

export function updateTransferLine(id: string, data: Prisma.StockTransferLineUpdateInput) {
  return prisma.stockTransferLine.update({ where: { id }, data });
}

// ── Badge counts ────────────────────────────────────────────────────────────

export function countAwaitingPrepare(branchId: string) {
  return prisma.stockTransfer.count({ where: { sourceBranchId: branchId, status: "approved" } });
}

export function countAwaitingReceive(branchId: string) {
  return prisma.stockTransfer.count({ where: { destBranchId: branchId, status: "prepared" } });
}

export function countPendingApproval() {
  return prisma.stockTransfer.count({ where: { status: "requested" } });
}
