import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { env } from "@/lib/env";

const DEFAULT_TEMP_PASSWORD = "1234";

/**
 * Create the login-capable Clerk account for a new employee: username + a
 * temporary password (weak by design, so `skipPasswordChecks` is required), and
 * `publicMetadata` carrying the employee role plus a `needsOnboarding` flag that
 * gates the first-login flow. Returns the new Clerk user id.
 */
export async function createEmployeeClerkUser(params: {
  username: string;
  firstName: string;
  lastName: string;
}): Promise<string> {
  const client = await clerkClient();
  const user = await client.users.createUser({
    username: params.username,
    password: env.EMPLOYEE_TEMP_PASSWORD ?? DEFAULT_TEMP_PASSWORD,
    skipPasswordChecks: true,
    firstName: params.firstName,
    lastName: params.lastName,
    publicMetadata: { needsOnboarding: true },
  });
  return user.id;
}

/**
 * Reset an employee's login back to the temporary password and re-arm the
 * first-login onboarding gate. For employees with no email, self-service
 * password recovery isn't possible, so the admin resets it here and hands the
 * temporary password out again; the employee is forced to set a new one on
 * their next sign-in.
 */
export async function resetEmployeePassword(clerkUserId: string): Promise<void> {
  const client = await clerkClient();
  const user = await client.users.getUser(clerkUserId);
  await client.users.updateUser(clerkUserId, {
    password: env.EMPLOYEE_TEMP_PASSWORD ?? DEFAULT_TEMP_PASSWORD,
    skipPasswordChecks: true,
    publicMetadata: { ...user.publicMetadata, needsOnboarding: true },
  });
}

/** Best-effort cleanup of a Clerk user when the linked Employee insert fails. */
export async function deleteClerkUser(clerkUserId: string): Promise<void> {
  try {
    const client = await clerkClient();
    await client.users.deleteUser(clerkUserId);
  } catch {
    // Swallow: the original failure is what we surface to the caller.
  }
}

/**
 * Ban a Clerk user, immediately revoking all sessions and preventing sign-in.
 * Called when an employee is terminated, resigned, or deactivated.
 */
export async function banClerkUser(clerkUserId: string): Promise<void> {
  const client = await clerkClient();
  await client.users.banUser(clerkUserId);
}

/**
 * Lift a Clerk ban so the user can sign in again.
 * Called if an employee status is restored to active.
 */
export async function unbanClerkUser(clerkUserId: string): Promise<void> {
  const client = await clerkClient();
  await client.users.unbanUser(clerkUserId);
}
