import "server-only";
import { cookies } from "next/headers";

/**
 * The kiosk's branch identity lives on the device/session, not the logged-in
 * employee (§4/§5.1). We persist the selected branch id in a cookie set
 * server-side; every kiosk action reads the branch from here rather than from
 * the operator's home-branch assignment.
 */
export const KIOSK_BRANCH_COOKIE = "kiosk_branch";

export async function getKioskBranchId(): Promise<string | null> {
  const store = await cookies();
  return store.get(KIOSK_BRANCH_COOKIE)?.value ?? null;
}

export async function setKioskBranchIdCookie(branchId: string): Promise<void> {
  const store = await cookies();
  store.set(KIOSK_BRANCH_COOKIE, branchId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Long-lived: a tablet stays pinned to its branch across restarts.
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearKioskBranchIdCookie(): Promise<void> {
  const store = await cookies();
  store.delete(KIOSK_BRANCH_COOKIE);
}
