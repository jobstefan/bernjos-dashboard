"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  createBranchSchema,
  updateBranchSchema,
} from "@/lib/validations/schedule";
import {
  createBranch,
  deleteBranch,
  updateBranch,
} from "@/server/services/branch.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

function revalidate() {
  revalidatePath("/branches");
  revalidatePath("/schedule");
}

export async function createBranchAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = createBranchSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const branch = await createBranch(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: branch.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function updateBranchAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = updateBranchSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const { id, ...rest } = parsed.data;
    const branch = await updateBranch(id, rest, actor);
    revalidate();
    return { success: true, data: { id: branch.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deleteBranchAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await deleteBranch(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
