import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { UnauthorizedError } from "@/lib/errors/payroll";
import type { Actor, Role } from "@/lib/types/payroll";

const VALID_ROLES: readonly Role[] = [
  "super_admin",
  "admin",
  "manager",
  "employee",
];

/**
 * Development RBAC bypass. While enabled, any signed-in user is treated as a
 * `super_admin` so every payroll/employee action (and its UI) is usable without
 * configuring Clerk roles yet. The role logic below is left fully intact — this
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

/** Normalize `super-admin`/`superadmin` etc. to a canonical Role. */
function normalizeRole(raw: unknown): Role {
  if (typeof raw !== "string") return "employee";
  const normalized = raw.trim().toLowerCase().replace(/[-\s]+/g, "_");
  return (VALID_ROLES as readonly string[]).includes(normalized)
    ? (normalized as Role)
    : "employee";
}

/** The user's effective role, applying the dev bypass. */
function resolveRole(raw: unknown): Role {
  if (isRbacBypassed()) return "super_admin";
  return normalizeRole(raw);
}

/**
 * Resolve the signed-in user into an {@link Actor}. Role comes from Clerk
 * `publicMetadata.role` (defaults to `employee`). Throws if nobody is signed in.
 */
export async function getActor(): Promise<Actor> {
  const user = await currentUser();
  if (!user) {
    throw new UnauthorizedError("You must be signed in.");
  }
  return {
    clerkUserId: user.id,
    email:
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses[0]?.emailAddress ??
      null,
    role: resolveRole(user.publicMetadata?.role),
  };
}

/** Convenience: just the current role (or `employee` if unauthenticated). */
export async function getCurrentRole(): Promise<Role> {
  const user = await currentUser();
  if (!user) return "employee";
  return resolveRole(user.publicMetadata?.role);
}

export function hasRole(actor: Actor, ...roles: Role[]): boolean {
  return roles.includes(actor.role);
}

export function isAdmin(role: Role): boolean {
  return role === "admin" || role === "super_admin";
}

/** Admins and managers can view payroll; only admins can mutate. */
export function canViewPayroll(role: Role): boolean {
  return role === "admin" || role === "super_admin" || role === "manager";
}

/** Admins, super-admins and managers can approve/decline cash advances. */
export function canApproveCashAdvance(role: Role): boolean {
  return role === "admin" || role === "super_admin" || role === "manager";
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

/** Assert the actor can approve/decline cash advances (admin, super-admin, manager). */
export async function requireApprover(): Promise<Actor> {
  return requireRole("admin", "super_admin", "manager");
}
