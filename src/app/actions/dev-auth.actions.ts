"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEV_SESSION_COOKIE,
  encodeDevSession,
  isDevAuthEnabled,
} from "@/lib/auth/dev-session";
import { findEmployeeByCode } from "@/server/db/employees";
import type { ActionResult } from "@/lib/types/action";
import type { Role } from "@/lib/types/payroll";

/** Static dev accounts, mirroring the seeded Clerk users (see prisma/seed-users.ts). */
const DEV_USERS: Record<Role, { email: string; employeeCode?: string }> = {
  super_admin: { email: "superadmin+clerk_test@example.com" },
  admin: { email: "admin+clerk_test@example.com" },
  manager: { email: "manager+clerk_test@example.com" },
  employee: { email: "employee+clerk_test@example.com", employeeCode: "EMP-0001" },
};

const ROLES: Role[] = ["super_admin", "admin", "manager", "employee"];

export async function devLoginAction(
  role: Role,
  password: string,
): Promise<ActionResult> {
  if (!isDevAuthEnabled()) {
    return { success: false, error: "Dev login is disabled." };
  }
  if (!ROLES.includes(role)) {
    return { success: false, error: "Unknown role." };
  }
  const expected = process.env.DEV_AUTH_PASSWORD ?? "1234";
  if (password !== expected) {
    return { success: false, error: "Incorrect password." };
  }

  const cfg = DEV_USERS[role];
  // For the employee, reuse the linked Employee's clerkUserId so self-service
  // lookups (payslips, cash advances) resolve exactly as under Clerk.
  let clerkUserId = `dev_${role}`;
  if (cfg.employeeCode) {
    const employee = await findEmployeeByCode(cfg.employeeCode);
    if (employee?.userId) {
      const { prisma } = await import("@/lib/db");
      const user = await prisma.user.findUnique({ where: { id: employee.userId }, select: { clerkId: true } });
      if (user?.clerkId) clerkUserId = user.clerkId;
    }
  }

  const store = await cookies();
  store.set(
    DEV_SESSION_COOKIE,
    encodeDevSession({ clerkUserId, email: cfg.email, role }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    },
  );
  return { success: true, data: undefined };
}

export async function devLogoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(DEV_SESSION_COOKIE);
  redirect("/sign-in");
}
