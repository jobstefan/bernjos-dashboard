import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

// ── Categories ──────────────────────────────────────────────────────────────

export function findCategories() {
  return prisma.productCategory.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: { where: { deletedAt: null } } } } },
  });
}

export function findCategoryById(id: string) {
  return prisma.productCategory.findFirst({ where: { id, deletedAt: null } });
}

export function insertCategory(data: Prisma.ProductCategoryCreateInput) {
  return prisma.productCategory.create({ data });
}

export function updateCategoryRow(id: string, data: Prisma.ProductCategoryUpdateInput) {
  return prisma.productCategory.update({ where: { id }, data });
}

export function softDeleteCategory(id: string) {
  return prisma.productCategory.update({ where: { id }, data: { deletedAt: new Date() } });
}

/** Count of live products in a category — used to block deleting a used category. */
export function countProductsInCategory(categoryId: string) {
  return prisma.product.count({ where: { categoryId, deletedAt: null } });
}

// ── Products ──────────────────────────────────────────────────────────────

const productWithCategory = {
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

export function findProducts() {
  return prisma.product.findMany({
    where: { deletedAt: null },
    include: productWithCategory,
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export function findProductById(id: string) {
  return prisma.product.findFirst({ where: { id, deletedAt: null }, include: productWithCategory });
}

export function insertProduct(data: Prisma.ProductCreateInput) {
  return prisma.product.create({ data, include: productWithCategory });
}

export function updateProductRow(id: string, data: Prisma.ProductUpdateInput) {
  return prisma.product.update({ where: { id }, data, include: productWithCategory });
}

export function softDeleteProduct(id: string) {
  return prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
}

// ── Branch reorder thresholds ────────────────────────────────────────────────

export function findThresholds() {
  return prisma.branchProductThreshold.findMany({
    include: {
      branch: { select: { name: true } },
      product: { select: { name: true, unit: true, deletedAt: true } },
    },
    orderBy: [{ branch: { name: "asc" } }, { product: { name: "asc" } }],
  });
}

export function findThresholdsForBranch(branchId: string) {
  return prisma.branchProductThreshold.findMany({ where: { branchId } });
}

/** Create or update the (branch, product) threshold in one call. */
export function upsertThreshold(branchId: string, productId: string, reorderThreshold: number) {
  return prisma.branchProductThreshold.upsert({
    where: { branchId_productId: { branchId, productId } },
    create: { branchId, productId, reorderThreshold },
    update: { reorderThreshold },
  });
}

export function deleteThreshold(branchId: string, productId: string) {
  return prisma.branchProductThreshold.deleteMany({ where: { branchId, productId } });
}
