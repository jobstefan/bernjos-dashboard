"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth/rbac";
import { createChargeSchema } from "@/lib/validations/payroll";
import { createCharge, deleteCharge, requestChargeDeletion } from "@/server/services/charge.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

function revalidate() {
  revalidatePath("/charges");
}

export async function createChargeAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = createChargeSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const charge = await createCharge(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: charge.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deleteChargeAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireSuperAdmin();
    await deleteCharge(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function requestChargeDeletionAction(id: string): Promise<ActionResult<void>> {
  try {
    const actor = await requireAdmin();
    await requestChargeDeletion(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
