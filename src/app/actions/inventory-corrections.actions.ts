"use server";

import { revalidatePath } from "next/cache";
import { requireInventoryManager } from "@/lib/auth/rbac";
import { correctEntry } from "@/server/services/inventory-corrections.service";
import { toActionError } from "@/server/errors";
import { BadRequestError } from "@/lib/errors/payroll";
import type { ActionResult } from "@/lib/types/action";

/** Admin/manager corrects a single entry quantity on a closed session (§5.6). */
export async function correctEntryAction(
  entryId: string,
  newQuantity: number,
  note?: string,
): Promise<ActionResult> {
  try {
    const actor = await requireInventoryManager();
    if (!Number.isInteger(newQuantity)) throw new BadRequestError("Enter a whole number.");
    await correctEntry(entryId, newQuantity, note ?? null, actor);
    revalidatePath("/inventory/corrections");
    revalidatePath("/inventory/reports");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
