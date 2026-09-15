"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  createCategorySchema,
  createProductSchema,
  updateCategorySchema,
  updateProductSchema,
  upsertThresholdSchema,
} from "@/lib/validations/inventory";
import {
  createCategory,
  createProduct,
  deleteCategory,
  deleteProduct,
  removeThreshold,
  saveThreshold,
  updateCategory,
  updateProduct,
} from "@/server/services/inventory-catalog.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

function revalidate() {
  revalidatePath("/inventory/products");
  revalidatePath("/inventory/categories");
  revalidatePath("/inventory/thresholds");
}

function fieldErrors(error: { flatten: () => { fieldErrors: unknown } }) {
  return {
    success: false as const,
    error: "Please fix the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}

// ── Categories ──────────────────────────────────────────────────────────────

export async function createCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = createCategorySchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    const cat = await createCategory(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: cat.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function updateCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = updateCategorySchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    const cat = await updateCategory(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: cat.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deleteCategoryAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await deleteCategory(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

// ── Products ──────────────────────────────────────────────────────────────

export async function createProductAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = createProductSchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    const product = await createProduct(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: product.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function updateProductAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = updateProductSchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    const product = await updateProduct(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: product.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await deleteProduct(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

// ── Thresholds ──────────────────────────────────────────────────────────────

export async function saveThresholdAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const parsed = upsertThresholdSchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    await saveThreshold(parsed.data, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function removeThresholdAction(
  branchId: string,
  productId: string,
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await removeThreshold(branchId, productId, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
