"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  createPositionSchema,
  updatePositionSchema,
} from "@/lib/validations/organization";
import {
  createPosition,
  deletePosition,
  updatePosition,
} from "@/server/services/position.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

function revalidate() {
  revalidatePath("/departments");
  // Position names feed the employee form dropdowns.
  revalidatePath("/employees");
}

export async function createPositionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = createPositionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const position = await createPosition(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: position.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function updatePositionAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = updatePositionSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const { id, ...rest } = parsed.data;
    const position = await updatePosition(id, rest, actor);
    revalidate();
    return { success: true, data: { id: position.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deletePositionAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await deletePosition(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
