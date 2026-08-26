import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db";
import type { Role } from "@/lib/types/payroll";

/**
 * Upserts the currently signed-in Clerk user into the database (keyed by
 * `clerkId`) and returns the local `User` row. Returns `null` if nobody is
 * signed in. This is the link between Clerk (auth source of truth) and our DB.
 *
 * On first create, checks ADMIN_EMAILS env var to bootstrap the initial admin
 * role. Role is never touched on subsequent upserts — DB is authoritative.
 */
export const getOrCreateUser = cache(async () => {
  const clerkUser = await getCurrentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;

  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  let bootstrapRole: Role = "employee";
  if (email && superAdminEmails.includes(email)) bootstrapRole = "super_admin";
  else if (email && adminEmails.includes(email)) bootstrapRole = "admin";

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
      // role is intentionally NOT updated here — DB is authoritative after create
    },
    create: {
      clerkId: clerkUser.id,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
      role: bootstrapRole,
    },
  });

  // Link profile if one shares this Clerk ID and isn't linked yet.
  await prisma.userProfile.updateMany({
    where: { user: { clerkId: clerkUser.id }, userId: null },
    data: { userId: user.id },
  });

  return user;
});
