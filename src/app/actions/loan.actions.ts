"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireSuperAdmin, getActor } from "@/lib/auth/rbac";
import {
  adminCreateLoanSchema,
  approveLoanSchema,
  cancelLoanSchema,
  createLoanSchema,
  declineLoanSchema,
  disburseLoanSchema,
} from "@/lib/validations/loan";
import {
  adminCreateLoan,
  approveLoan,
  cancelLoan,
  declineLoan,
  deleteLoan,
  disburseLoan,
  requestLoan,
  requestLoanDeletion,
} from "@/server/services/loan.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

function revalidate() {
  revalidatePath("/savings");
  revalidatePath("/savings/mine");
}

/** Employee requests a loan (or admin on behalf via different action). */
export async function requestLoanAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await getActor();
    const parsed = createLoanSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const result = await requestLoan(parsed.data, actor);
    revalidate();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

/** Admin creates and immediately disburses a loan for any employee. */
export async function adminCreateLoanAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAdmin();
    const parsed = adminCreateLoanSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const result = await adminCreateLoan(parsed.data, actor);
    revalidate();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

/** Admin approves a pending loan request. */
export async function approveLoanAction(
  input: unknown,
): Promise<ActionResult<void>> {
  try {
    const actor = await requireAdmin();
    const parsed = approveLoanSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid request." };
    }
    await approveLoan(parsed.data, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

/** Admin declines a pending loan request. */
export async function declineLoanAction(
  input: unknown,
): Promise<ActionResult<void>> {
  try {
    const actor = await requireAdmin();
    const parsed = declineLoanSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    await declineLoan(parsed.data, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

/** Admin disburses an approved loan. */
export async function disburseLoanAction(
  input: unknown,
): Promise<ActionResult<void>> {
  try {
    const actor = await requireAdmin();
    const parsed = disburseLoanSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid request." };
    }
    await disburseLoan(parsed.data.id, actor, parsed.data.branchId);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

/** Employee cancels their own pending loan; admin can cancel pending or approved. */
export async function cancelLoanAction(
  input: unknown,
): Promise<ActionResult<void>> {
  try {
    const actor = await getActor();
    const parsed = cancelLoanSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: "Invalid request." };
    }
    await cancelLoan(parsed.data.id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function requestLoanDeletionAction(id: string): Promise<ActionResult<void>> {
  try {
    const actor = await requireAdmin();
    await requestLoanDeletion(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deleteLoanAction(id: string): Promise<ActionResult<void>> {
  try {
    const actor = await requireSuperAdmin();
    await deleteLoan(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
