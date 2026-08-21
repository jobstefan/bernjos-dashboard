import "server-only";
import { cookies } from "next/headers";
import type { Role } from "@/lib/types/payroll";

/**
 * Local development login that bypasses Clerk. When `DEV_AUTH=true`, the app
 * authenticates via a signed-in-role cookie instead of Clerk, so you can log in
 * with just a role + password (no email/SMS verification). Never enable in
 * production — this is intentionally trivial.
 */

export const DEV_SESSION_COOKIE = "dev_session";

export function isDevAuthEnabled(): boolean {
  return process.env.DEV_AUTH === "true";
}

export interface DevSession {
  clerkUserId: string;
  email: string | null;
  role: Role;
}

export function encodeDevSession(session: DevSession): string {
  return Buffer.from(JSON.stringify(session), "utf8").toString("base64");
}

export function decodeDevSession(value: string | undefined): DevSession | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as DevSession;
  } catch {
    return null;
  }
}

/** Read the current dev session from the request cookies (server only). */
export async function readDevSession(): Promise<DevSession | null> {
  const store = await cookies();
  return decodeDevSession(store.get(DEV_SESSION_COOKIE)?.value);
}
