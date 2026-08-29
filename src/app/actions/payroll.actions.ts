"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth/rbac";
import {
  createPeriodSchema,
  updatePeriodDatesSchema,
  updatePayslipRemarksSchema,
} from "@/lib/validations/payroll";
import {
  approvePayrollRun,
  calculatePayrollRun,
  createPayrollPeriod,
  deletePayrollPeriod,
  markPayrollPaid,
  submitForApproval,
  updatePayrollPeriodDates,
  updatePayslipRemarks,
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

export async function updatePayslipRemarksAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const parsed = updatePayslipRemarksSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    await updatePayslipRemarks(
      parsed.data.runItemId,
      parsed.data.remarks ?? null,
      actor,
    );
    revalidatePath("/payroll");
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

export async function updatePeriodDatesAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const actor = await requireSuperAdmin();
    const parsed = updatePeriodDatesSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    await updatePayrollPeriodDates(parsed.data.id, parsed.data, actor);
    revalidatePath("/payroll");
    revalidatePath(`/payroll/${parsed.data.id}`);
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deletePeriodAction(periodId: string): Promise<ActionResult> {
  try {
    const actor = await requireSuperAdmin();
    await deletePayrollPeriod(periodId, actor);
    revalidatePath("/payroll");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
