"use server";

import { revalidatePath } from "next/cache";
import { getActor, requireApprover, requireRole } from "@/lib/auth/rbac";
import {
  approveCashAdvanceSchema,
  createCashAdvanceSchema,
  declineCashAdvanceSchema,
} from "@/lib/validations/payroll";
import {
  approveCashAdvance,
  cancelCashAdvance,
  declineCashAdvance,
  deleteCashAdvance,
  requestCashAdvance,
} from "@/server/services/cash-advance.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

function revalidate() {
  revalidatePath("/cash-advances");
  revalidatePath("/cash-advances/mine");
}

export async function requestCashAdvanceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const parsed = createCashAdvanceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const advance = await requestCashAdvance(parsed.data, actor);
    revalidate();
    return { success: true, data: { id: advance.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function approveCashAdvanceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireApprover();
    const parsed = approveCashAdvanceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const advance = await approveCashAdvance(
      parsed.data.id,
      parsed.data.approvedAmount,
      parsed.data.note ?? null,
      actor,
    );
    revalidate();
    return { success: true, data: { id: advance.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function declineCashAdvanceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireApprover();
    const parsed = declineCashAdvanceSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const advance = await declineCashAdvance(
      parsed.data.id,
      parsed.data.reason,
      actor,
    );
    revalidate();
    return { success: true, data: { id: advance.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function cancelCashAdvanceAction(id: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    await cancelCashAdvance(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deleteCashAdvanceAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireRole("super_admin");
    await deleteCashAdvance(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
