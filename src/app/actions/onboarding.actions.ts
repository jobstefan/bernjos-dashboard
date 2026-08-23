"use server";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { z } from "zod";
import type { ActionResult } from "@/lib/types/action";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.");

/** Surface Clerk's own validation message (e.g. weak/compromised password). */
function clerkError(error: unknown, fallback: string): string {
  if (isClerkAPIResponseError(error)) {
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? fallback;
  }
  return fallback;
}

/**
 * Set the employee's real password during first-login onboarding. Runs through
 * the backend API (no current-password prompt) but WITHOUT `skipPasswordChecks`,
 * so Clerk enforces the instance password policy.
 */
export async function setNewPasswordAction(
  password: unknown,
): Promise<ActionResult> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return { success: false, error: "You must be signed in." };
    }
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }
    const client = await clerkClient();
    await client.users.updateUser(userId, { password: parsed.data });
    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: clerkError(error, "Couldn't update your password. Please try again."),
    };
  }
}

/**
 * Finish onboarding: clear the `needsOnboarding` flag (preserving the role).
 * Called after the client has set the new password. Email is admin-entered on
 * the employee record, not collected here, so there's nothing else to sync.
 */
export async function completeOnboardingAction(): Promise<ActionResult> {
  try {
    const user = await currentUser();
    if (!user) {
      return { success: false, error: "You must be signed in." };
    }

    const client = await clerkClient();
    await client.users.updateUser(user.id, {
      publicMetadata: { ...user.publicMetadata, needsOnboarding: false },
    });

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: clerkError(error, "Couldn't finish setup. Please try again."),
    };
  }
}
