import "server-only";
import {
  countProductsInCategory,
  deleteThreshold,
  findCategories,
  findCategoryById,
  findProductById,
  findProducts,
  findThresholds,
  insertCategory,
  insertProduct,
  softDeleteCategory,
  softDeleteProduct,
  updateCategoryRow,
  updateProductRow,
  upsertThreshold,
} from "@/server/db/inventory-catalog";
import { auditLog } from "@/server/services/audit.service";
import { BadRequestError, NotFoundError } from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type { CategoryRow, ProductRow, ThresholdRow } from "@/lib/types/inventory";
import type {
  CreateCategorySchema,
  CreateProductSchema,
  UpdateCategorySchema,
  UpdateProductSchema,
  UpsertThresholdSchema,
} from "@/lib/validations/inventory";

// ── Categories ──────────────────────────────────────────────────────────────

export async function getCategories(): Promise<CategoryRow[]> {
  const rows = await findCategories();
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    productCount: c._count.products,
    createdAt: c.createdAt.toISOString(),
  }));
}

export async function createCategory(input: CreateCategorySchema, actor: Actor) {
  const category = await insertCategory({ name: input.name });
  await auditLog({ actor, action: "inventory.category.created", entityType: "product_category", entityId: category.id, after: category });
  return category;
}

export async function updateCategory(input: UpdateCategorySchema, actor: Actor) {
  const before = await findCategoryById(input.id);
  if (!before) throw new NotFoundError("Category", input.id);
  const after = await updateCategoryRow(input.id, { name: input.name });
  await auditLog({ actor, action: "inventory.category.updated", entityType: "product_category", entityId: input.id, before, after });
  return after;
}

export async function deleteCategory(id: string, actor: Actor): Promise<void> {
  const before = await findCategoryById(id);
  if (!before) throw new NotFoundError("Category", id);
  const inUse = await countProductsInCategory(id);
  if (inUse > 0) {
    throw new BadRequestError(
      `This category still has ${inUse} product${inUse === 1 ? "" : "s"}. Move or retire them first.`,
    );
  }
  const after = await softDeleteCategory(id);
  await auditLog({ actor, action: "inventory.category.deleted", entityType: "product_category", entityId: id, before, after });
}

// ── Products ──────────────────────────────────────────────────────────────

function toProductRow(p: Awaited<ReturnType<typeof findProductById>>): ProductRow {
  if (!p) throw new NotFoundError("Product", "unknown");
  return {
    id: p.id,
    name: p.name,
    unit: p.unit,
    type: p.type,
    price: p.price == null ? null : Number(p.price),
    categoryId: p.categoryId,
    categoryName: p.category.name,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function getProducts(): Promise<ProductRow[]> {
  const rows = await findProducts();
  return rows.map(toProductRow);
}

export async function createProduct(input: CreateProductSchema, actor: Actor): Promise<ProductRow> {
  const product = await insertProduct({
    name: input.name,
    unit: input.unit,
    type: input.type,
    price: input.type === "sale" ? input.price! : null,
    category: { connect: { id: input.categoryId } },
    createdBy: actor.clerkUserId,
  });
  await auditLog({ actor, action: "inventory.product.created", entityType: "product", entityId: product.id, after: product });
  return toProductRow(product);
}

export async function updateProduct(input: UpdateProductSchema, actor: Actor): Promise<ProductRow> {
  const before = await findProductById(input.id);
  if (!before) throw new NotFoundError("Product", input.id);
  const after = await updateProductRow(input.id, {
    name: input.name,
    unit: input.unit,
    type: input.type,
    price: input.type === "sale" ? input.price! : null,
    category: { connect: { id: input.categoryId } },
  });
  await auditLog({ actor, action: "inventory.product.updated", entityType: "product", entityId: input.id, before, after });
  return toProductRow(after);
}

export async function deleteProduct(id: string, actor: Actor): Promise<void> {
  const before = await findProductById(id);
  if (!before) throw new NotFoundError("Product", id);
  const after = await softDeleteProduct(id);
  await auditLog({ actor, action: "inventory.product.deleted", entityType: "product", entityId: id, before, after });
}

// ── Thresholds ──────────────────────────────────────────────────────────────

export async function getThresholds(): Promise<ThresholdRow[]> {
  const rows = await findThresholds();
  return rows
    .filter((t) => t.product.deletedAt === null)
    .map((t) => ({
      id: t.id,
      branchId: t.branchId,
      branchName: t.branch.name,
      productId: t.productId,
      productName: t.product.name,
      unit: t.product.unit,
      reorderThreshold: t.reorderThreshold,
    }));
}

export async function saveThreshold(input: UpsertThresholdSchema, actor: Actor): Promise<void> {
  const after = await upsertThreshold(input.branchId, input.productId, input.reorderThreshold);
  await auditLog({
    actor,
    action: "inventory.threshold.saved",
    entityType: "branch_product_threshold",
    entityId: after.id,
    after,
  });
}

export async function removeThreshold(branchId: string, productId: string, actor: Actor): Promise<void> {
  await deleteThreshold(branchId, productId);
  await auditLog({
    actor,
    action: "inventory.threshold.removed",
    entityType: "branch_product_threshold",
    entityId: `${branchId}:${productId}`,
  });
}
