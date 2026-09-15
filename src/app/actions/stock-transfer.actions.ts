"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireInventoryManager, requireInventoryOperator } from "@/lib/auth/rbac";
import { getKioskBranchId } from "@/lib/kiosk/branch-cookie";
import { findTransferById } from "@/server/db/stock-transfer";
import {
  approveTransfer,
  cancelTransfer,
  declineTransfer,
  prepareTransfer,
  receiveTransfer,
  requestTransfer,
  resolveDiscrepancy,
} from "@/server/services/stock-transfer.service";
import {
  prepareTransferSchema,
  receiveTransferSchema,
  requestTransferSchema,
  resolveDiscrepancySchema,
} from "@/lib/validations/stock-transfer";
import { toActionError } from "@/server/errors";
import { BadRequestError } from "@/lib/errors/payroll";
import type { ActionResult } from "@/lib/types/action";

function fieldErrors(error: { flatten: () => { fieldErrors: unknown } }) {
  return {
    success: false as const,
    error: "Please fix the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}

function revalidate() {
  revalidatePath("/kiosk");
  revalidatePath("/inventory/transfers");
}

async function requireKioskBranch(): Promise<string> {
  const branchId = await getKioskBranchId();
  if (!branchId) throw new BadRequestError("This device isn't assigned to a branch yet.");
  return branchId;
}

// ── Kiosk (operator) ────────────────────────────────────────────────────────

export async function requestTransferAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireInventoryOperator();
    const branchId = await requireKioskBranch();
    const parsed = requestTransferSchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    const result = await requestTransfer(branchId, parsed.data, actor);
    revalidate();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function prepareTransferAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireInventoryOperator();
    const branchId = await requireKioskBranch();
    const parsed = prepareTransferSchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    const transfer = await findTransferById(parsed.data.transferId);
    if (!transfer || transfer.sourceBranchId !== branchId) {
      throw new BadRequestError("This transfer isn't for your branch to prepare.");
    }
    await prepareTransfer(parsed.data, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function receiveTransferAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireInventoryOperator();
    const branchId = await requireKioskBranch();
    const parsed = receiveTransferSchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    const transfer = await findTransferById(parsed.data.transferId);
    if (!transfer || transfer.destBranchId !== branchId) {
      throw new BadRequestError("This transfer isn't for your branch to receive.");
    }
    await receiveTransfer(parsed.data, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function cancelTransferAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireInventoryOperator();
    const branchId = await requireKioskBranch();
    const transfer = await findTransferById(id);
    if (!transfer || transfer.destBranchId !== branchId) {
      throw new BadRequestError("You can only cancel your own branch's request.");
    }
    await cancelTransfer(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

// ── Admin / manager ──────────────────────────────────────────────────────

export async function approveTransferAction(id: string): Promise<ActionResult> {
  try {
    const actor = await requireInventoryManager();
    await approveTransfer(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function declineTransferAction(id: string, note?: string): Promise<ActionResult> {
  try {
    const actor = await requireInventoryManager();
    await declineTransfer(id, note ?? null, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function resolveDiscrepancyAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const parsed = resolveDiscrepancySchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    await resolveDiscrepancy(parsed.data, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
