"use server";

import { revalidatePath } from "next/cache";
import { getActor, requireAdmin, requireApprover } from "@/lib/auth/rbac";
import {
  approveAbsenceRequest,
  cancelAbsenceRequest,
  createAbsenceRequestAdmin,
  declineAbsenceRequest,
  deleteAbsenceRequest,
  requestAbsence,
} from "@/server/services/absence-request.service";
import { toActionError } from "@/server/errors";
import type { ActionResult } from "@/lib/types/action";
import type { AbsenceRequestRow } from "@/server/services/absence-request.service";

function revalidate() {
  revalidatePath("/schedule");
  revalidatePath("/schedule/mine");
}

export async function requestAbsenceAction(
  startDateIso: string,
  endDateIso: string,
  reason?: string,
): Promise<ActionResult<AbsenceRequestRow>> {
  try {
    const actor = await getActor();
    if (!startDateIso || !endDateIso) {
      return { success: false, error: "A date is required." };
    }
    const row = await requestAbsence(startDateIso, endDateIso, reason ?? null, actor);
    revalidate();
    return { success: true, data: row };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function cancelAbsenceRequestAction(
  id: string,
): Promise<ActionResult> {
  try {
    const actor = await getActor();
    await cancelAbsenceRequest(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function createAbsenceRequestAdminAction(input: {
  employeeId: string;
  startDateIso: string;
  endDateIso: string;
  reason?: string;
}): Promise<ActionResult<AbsenceRequestRow>> {
  try {
    const actor = await requireAdmin();
    if (!input.employeeId || !input.startDateIso || !input.endDateIso) {
      return { success: false, error: "Employee and date are required." };
    }
    const row = await createAbsenceRequestAdmin(
      input.employeeId,
      input.startDateIso,
      input.endDateIso,
      input.reason ?? null,
      actor,
    );
    revalidate();
    return { success: true, data: row };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function approveAbsenceRequestAction(
  id: string,
  startDateIso: string,
  endDateIso: string,
  note?: string,
): Promise<ActionResult<AbsenceRequestRow>> {
  try {
    const actor = await requireApprover();
    if (!startDateIso || !endDateIso) {
      return { success: false, error: "Date range is required." };
    }
    const row = await approveAbsenceRequest(id, actor, startDateIso, endDateIso, note);
    revalidate();
    return { success: true, data: row };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function deleteAbsenceRequestAction(
  id: string,
): Promise<ActionResult> {
  try {
    const actor = await requireApprover();
    await deleteAbsenceRequest(id, actor);
    revalidate();
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}

export async function declineAbsenceRequestAction(
  id: string,
  note?: string,
): Promise<ActionResult<AbsenceRequestRow>> {
  try {
    const actor = await requireApprover();
    const row = await declineAbsenceRequest(id, note ?? null, actor);
    revalidate();
    return { success: true, data: row };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
