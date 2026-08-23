"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from "@/lib/validations/organization";
import {
  createDepartment,
  deleteDepartment,
  updateDepartment,
} from "@/server/services/department.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

function revalidate() {
  revalidatePath("/departments");
  // Department names feed the employee form dropdowns.
  revalidatePath("/employees");
}

export async function createDepartmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = createDepartmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const department = await createDepartment(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: department.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function updateDepartmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = updateDepartmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const { id, ...rest } = parsed.data;
    const department = await updateDepartment(id, rest, actor);
    revalidate();
    return { success: true, data: { id: department.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deleteDepartmentAction(
  id: string,
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await deleteDepartment(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
