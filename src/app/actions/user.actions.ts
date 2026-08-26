"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { auditLog } from "@/server/services/audit.service";
import { toActionError } from "@/server/errors";
import { UnauthorizedError } from "@/lib/errors/payroll";
import type { ActionResult } from "@/lib/types/action";
import type { Role } from "@/lib/types/payroll";

const updateRoleSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["super_admin", "admin", "manager", "employee"]),
});

export async function updateUserRoleAction(
  input: unknown,
): Promise<ActionResult> {
  try {
    const actor = await requireAdmin();

    const parsed = updateRoleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid input.",
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }

    const { userId, role } = parsed.data;

    // Fetch target user to get clerkId and current role
    const target = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!target) {
      return { success: false, error: "User not found." };
    }

    // Cannot change own role
    if (target.clerkId === actor.clerkUserId) {
      throw new UnauthorizedError("You cannot change your own role.");
    }

    // Admin cannot assign admin or super_admin — only super_admin can
    if (actor.role === "admin" && (role === "admin" || role === "super_admin")) {
      throw new UnauthorizedError("Only a super admin can assign the admin or super admin role.");
    }

    const before = { role: target.role };

    // Update the role
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: role as Role },
    });

    await auditLog({
      actor,
      action: "user.role_updated",
      entityType: "user",
      entityId: userId,
      before,
      after: { role: updated.role },
    });

    revalidatePath("/settings/users");
    revalidatePath("/employees");
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, ...toActionError(error) };
  }
}
