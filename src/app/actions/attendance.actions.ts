"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  mapDeviceSchema,
  uploadAttendanceSchema,
} from "@/lib/validations/attendance";
import {
  deleteImport,
  mapDevice,
  startImport,
} from "@/server/services/attendance.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

export async function uploadAttendanceAction(
  input: unknown,
): Promise<ActionResult<{ importId: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = uploadAttendanceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const imp = await startImport(parsed.data, actor);
    revalidatePath("/attendance");
    return { success: true, data: { importId: imp.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deleteImportAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await deleteImport(id, actor);
    revalidatePath("/attendance");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function mapDeviceAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const parsed = mapDeviceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    await mapDevice(parsed.data, actor);
    revalidatePath("/attendance");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
