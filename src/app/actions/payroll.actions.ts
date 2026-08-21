"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import { createPeriodSchema } from "@/lib/validations/payroll";
import {
  approvePayrollRun,
  calculatePayrollRun,
  createPayrollPeriod,
  markPayrollPaid,
  submitForApproval,
} from "@/server/services/payroll.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

export async function createPeriodAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = createPeriodSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const period = await createPayrollPeriod(parsed.data, actor);
    revalidatePath("/payroll");
    return { success: true, data: { id: period.id } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function calculateRunAction(periodId: string): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await calculatePayrollRun(periodId, actor);
    revalidatePath("/payroll");
    revalidatePath(`/payroll/${periodId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function submitForApprovalAction(
  periodId: string,
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await submitForApproval(periodId, actor);
    revalidatePath("/payroll");
    revalidatePath(`/payroll/${periodId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function approveRunAction(periodId: string): Promise<ActionResult> {
  try {
    // Approval is restricted to admin / super-admin.
    const actor = await requireAdmin();
    await approvePayrollRun(periodId, actor);
    revalidatePath("/payroll");
    revalidatePath(`/payroll/${periodId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function markPaidAction(periodId: string): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    await markPayrollPaid(periodId, actor);
    revalidatePath("/payroll");
    revalidatePath(`/payroll/${periodId}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
