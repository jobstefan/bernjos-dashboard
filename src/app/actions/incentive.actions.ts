"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth/rbac";
import { createIncentiveSchema, cancelIncentiveSchema } from "@/lib/validations/incentive";
import {
  cancelIncentive,
  createIncentive,
  deleteIncentive,
  requestIncentiveDeletion,
} from "@/server/services/incentive.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

function revalidate() {
  revalidatePath("/incentives");
}

export async function createIncentiveAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = createIncentiveSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const result = await createIncentive(parsed.data, actor);
    revalidate();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function cancelIncentiveAction(
  input: unknown,
): Promise<ActionResult<void>> {
  try {
    const actor = await requireAdmin();
    const parsed = cancelIncentiveSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid request." };
    }
    await cancelIncentive(parsed.data, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function requestIncentiveDeletionAction(id: string): Promise<ActionResult<void>> {
  try {
    const actor = await requireAdmin();
    await requestIncentiveDeletion(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deleteIncentiveAction(id: string): Promise<ActionResult<void>> {
  try {
    const actor = await requireSuperAdmin();
    await deleteIncentive(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
