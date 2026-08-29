import "server-only";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOrCreateUser } from "@/lib/user";
import { UnauthorizedError } from "@/lib/errors/payroll";
import { isDevAuthEnabled, readDevSession } from "@/lib/auth/dev-session";
import type { Actor, Role } from "@/lib/types/payroll";

/**
 * Development RBAC bypass. While enabled, any signed-in user is treated as a
 * `super_admin` so every payroll/employee action (and its UI) is usable without
 * configuring roles yet. The role logic below is left fully intact — this
 * only overrides the *resolved* role.
 *
 * Defaults on outside production. Override explicitly with PAYROLL_RBAC_BYPASS:
 *   "true"  → force on (even in production),
 *   "false" → force off (enforce real roles, even in dev).
 */
function isRbacBypassed(): boolean {
  const flag = process.env.PAYROLL_RBAC_BYPASS?.toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * Resolve the signed-in user into an {@link Actor}. Role comes from the DB
 * `User.role` column (defaults to `employee`). Throws if nobody is signed in.
 */
export async function getActor(): Promise<Actor> {
  // Local dev login (Clerk bypassed): resolve the actor from the dev cookie.
  if (isDevAuthEnabled()) {
    const session = await readDevSession();
    if (!session) throw new UnauthorizedError("You must be signed in.");
    return {
      clerkUserId: session.clerkUserId,
      email: session.email,
      role: session.role,
    };
  }

  const clerkUser = await getCurrentUser();
  if (!clerkUser) {
    throw new UnauthorizedError("You must be signed in.");
  }

  const role: Role = isRbacBypassed()
    ? "super_admin"
    : ((await getOrCreateUser())?.role ?? "employee") as Role;

  return {
    clerkUserId: clerkUser.id,
    email:
      clerkUser.primaryEmailAddress?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      null,
    role,
  };
}

/** Convenience: just the current role (or `employee` if unauthenticated). */
export async function getCurrentRole(): Promise<Role> {
  if (isDevAuthEnabled()) {
    const session = await readDevSession();
    return session?.role ?? "employee";
  }

  if (isRbacBypassed()) return "super_admin";

  const user = await getOrCreateUser();
  return (user?.role ?? "employee") as Role;
}

export function hasRole(actor: Actor, ...roles: Role[]): boolean {
  return roles.includes(actor.role);
}

export function isAdmin(role: Role): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdmin(role: Role): boolean {
  return role === "super_admin";
}

/** Admins and managers can view payroll; only admins can mutate. */
export function canViewPayroll(role: Role): boolean {
  return role === "admin" || role === "super_admin" || role === "manager";
}

/** Admins, super-admins and managers can approve/decline cash advances. */
export function canApproveCashAdvance(role: Role): boolean {
  return role === "admin" || role === "super_admin" || role === "manager";
}

/** Admins, super-admins and managers can view the daily schedule board. */
export function canViewSchedule(role: Role): boolean {
  return role === "admin" || role === "super_admin" || role === "manager";
}

/** Only admins and super-admins can edit the schedule or manage branches. */
export function canManageSchedule(role: Role): boolean {
  return role === "admin" || role === "super_admin";
}

/** Only admins and super-admins upload attendance and map devices. */
export function canManageAttendance(role: Role): boolean {
  return role === "admin" || role === "super_admin";
}

/**
 * Only admins and super-admins supervise all profiles' savings. Managers, like
 * employees, only ever see their own savings (self-service page).
 */
export function canSuperviseSavings(role: Role): boolean {
  return isAdmin(role);
}

/**
 * Assert the actor holds one of `roles`. Returns the actor for convenient
 * chaining. Throws {@link UnauthorizedError} otherwise.
 */
export async function requireRole(...roles: Role[]): Promise<Actor> {
  const actor = await getActor();
  if (!roles.includes(actor.role)) {
    throw new UnauthorizedError();
  }
  return actor;
}

/** Assert the actor is an admin or super-admin (full payroll access). */
export async function requireAdmin(): Promise<Actor> {
  return requireRole("admin", "super_admin");
}

/** Assert the actor is a super-admin (elevated destructive actions). */
export async function requireSuperAdmin(): Promise<Actor> {
  return requireRole("super_admin");
}

/** Assert the actor can approve/decline cash advances (admin, super-admin, manager). */
export async function requireApprover(): Promise<Actor> {
  return requireRole("admin", "super_admin", "manager");
}
