"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
} from "@/lib/validations/payroll";
import {
  createEmployee,
  deactivateEmployee,
  updateEmployee,
} from "@/server/services/employee.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

export async function createEmployeeAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = createEmployeeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const employee = await createEmployee(parsed.data, actor);
    revalidatePath("/employees");
    return { success: true, data: { id: employee.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function updateEmployeeAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = updateEmployeeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const { id, ...rest } = parsed.data;
    const employee = await updateEmployee(id, rest, actor);
    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return { success: true, data: { id: employee.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deactivateEmployeeAction(
  id: string,
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await deactivateEmployee(id, actor);
    revalidatePath("/employees");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
