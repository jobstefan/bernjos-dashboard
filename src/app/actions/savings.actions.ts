"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import {
  savingsAdjustmentSchema,
  upsertSavingsAccountSchema,
} from "@/lib/validations/savings";
import {
  recordSavingsAdjustment,
  upsertSavingsAccount,
} from "@/server/services/savings.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

function revalidate() {
  revalidatePath("/savings");
  revalidatePath("/savings/mine");
}

export async function upsertSavingsAccountAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = upsertSavingsAccountSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      };
    }
    const account = await upsertSavingsAccount(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: account.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function recordSavingsAdjustmentAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = savingsAdjustmentSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      };
    }
    const transaction = await recordSavingsAdjustment(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: transaction.accountId } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
