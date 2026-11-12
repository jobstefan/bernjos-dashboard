"use server";

import { revalidatePath } from "next/cache";
import { requireInventoryOperator, requireInventoryManager } from "@/lib/auth/rbac";
import {
  closeSessionSchema,
  logRestockSchema,
  logWastageSchema,
  openSessionSchema,
  syncOfflineEntriesSchema,
} from "@/lib/validations/inventory-session";
import {
  closeSession,
  logRestock,
  logWastage,
  openOrContinueSession,
  syncOfflineEntries,
  type SyncResult,
} from "@/server/services/inventory.service";
import {
  clearKioskBranchIdCookie,
  getKioskBranchId,
  setKioskBranchIdCookie,
} from "@/lib/kiosk/branch-cookie";
import { findBranchById } from "@/server/db/branches";
import { toActionError } from "@/server/errors";
import { BadRequestError } from "@/lib/errors/payroll";
import type { ActionResult } from "@/lib/types/action";
import type { EodSummary } from "@/lib/types/inventory";

function fieldErrors(error: { flatten: () => { fieldErrors: unknown } }) {
  return {
    success: false as const,
    error: "Please fix the highlighted fields.",
    fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}

/** Pin this device/session to a branch (kiosk branch identity — §5.1). */
export async function setKioskBranchAction(branchId: string): Promise<ActionResult> {
  try {
    await requireInventoryOperator();
    const branch = await findBranchById(branchId);
    if (!branch) throw new BadRequestError("Unknown branch.");
    await setKioskBranchIdCookie(branchId);
    revalidatePath("/kiosk");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

/** Un-pin the device so a different branch can be selected (admin/manager). */
export async function clearKioskBranchAction(): Promise<ActionResult> {
  try {
    await requireInventoryManager();
    await clearKioskBranchIdCookie();
    revalidatePath("/kiosk");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

/** Open or continue today's session for the pinned branch. Returns the id. */
export async function openSessionAction(input?: unknown): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const actor = await requireInventoryOperator();
    const branchId = await getKioskBranchId();
    if (!branchId) throw new BadRequestError("This device isn't assigned to a branch yet.");
    const parsed = openSessionSchema.safeParse(input ?? {});
    const counts = parsed.success ? parsed.data.counts : undefined;
    const { sessionId } = await openOrContinueSession(branchId, actor, counts);
    revalidatePath("/kiosk");
    return { success: true, data: { sessionId } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function logRestockAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireInventoryOperator();
    const parsed = logRestockSchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    await logRestock(parsed.data, actor);
    revalidatePath("/kiosk");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function logWastageAction(input: unknown): Promise<ActionResult> {
  try {
    const actor = await requireInventoryOperator();
    const parsed = logWastageSchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    await logWastage(parsed.data, actor);
    revalidatePath("/kiosk");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function closeSessionAction(input: unknown): Promise<ActionResult<{ summary: EodSummary }>> {
  try {
    const actor = await requireInventoryOperator();
    const parsed = closeSessionSchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    const summary = await closeSession(parsed.data, actor);
    revalidatePath("/kiosk");
    return { success: true, data: { summary } };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

/** Replay offline-queued entries on reconnect (§6/§9.7). */
export async function syncOfflineEntriesAction(input: unknown): Promise<ActionResult<SyncResult>> {
  try {
    const actor = await requireInventoryOperator();
    const parsed = syncOfflineEntriesSchema.safeParse(input);
    if (!parsed.success) return fieldErrors(parsed.error);
    const result = await syncOfflineEntries(parsed.data.entries, actor);
    revalidatePath("/kiosk");
    return { success: true, data: result };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
