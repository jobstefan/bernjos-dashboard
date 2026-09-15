"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireInventoryOperator } from "@/lib/auth/rbac";
import { getKioskBranchId } from "@/lib/kiosk/branch-cookie";
import {
  releaseBySlip,
  undoAdvanceRelease,
  undoLoanRelease,
} from "@/server/services/inventory-release.service";
import { toActionError } from "@/server/errors";
import { BadRequestError } from "@/lib/errors/payroll";
import type { ActionResult } from "@/lib/types/action";

/** Kiosk: release an approved advance/loan by its slip code (single tap). */
export async function releaseBySlipAction(
  slipNumber: string,
): Promise<ActionResult<{ kind: "advance" | "loan" }>> {
  try {
    const actor = await requireInventoryOperator();
    const branchId = await getKioskBranchId();
    if (!branchId) throw new BadRequestError("This device isn't assigned to a branch yet.");
    if (!slipNumber.trim()) throw new BadRequestError("Enter a slip code.");
    const result = await releaseBySlip(slipNumber, branchId, actor);
    revalidatePath("/kiosk");
    revalidatePath("/inventory/unreleased");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

/** Admin: undo a mistaken release (only while it hasn't fed an approved period). */
export async function undoReleaseAction(
  kind: "advance" | "loan",
  id: string,
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    if (kind === "advance") await undoAdvanceRelease(id, actor);
    else await undoLoanRelease(id, actor);
    revalidatePath("/inventory/unreleased");
    revalidatePath("/cash-advances");
    revalidatePath("/savings");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
