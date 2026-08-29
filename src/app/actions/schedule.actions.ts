"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/rbac";
import { saveDayScheduleSchema } from "@/lib/validations/schedule";
import { saveDaySchedule } from "@/server/services/schedule.service";
import { findEntriesByDate } from "@/server/db/schedule";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";

export async function saveDayScheduleAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();
    const parsed = saveDayScheduleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    await saveDaySchedule(
      parsed.data.date,
      parsed.data.entries.map((e) => ({
        employeeId: e.employeeId,
        branchId: e.branchId ?? null,
        startTime: e.startTime,
        endTime: e.endTime,
        note: e.note ?? null,
      })),
      actor,
    );
    revalidatePath("/schedule");
    revalidatePath("/schedule/mine");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function getPreviousDayEntriesAction(dateIso: string): Promise<
  ActionResult<{ employeeId: string; branchId: string | null; startTime: string; endTime: string; note: string | null }[]>
> {
  try {
    await requireAdmin();
    const date = new Date(`${dateIso}T00:00:00.000Z`);
    const prevDate = new Date(date);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const entries = await findEntriesByDate(prevDate);
    return {
      success: true,
      data: entries.map((e) => ({
        employeeId: e.profileId,
        branchId: e.branchId ?? null,
        startTime: e.startTime,
        endTime: e.endTime,
        note: e.note ?? null,
      })),
    };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
