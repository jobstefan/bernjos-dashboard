import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

/**
 * Upserts the currently signed-in Clerk user into the database (keyed by
 * `clerkId`) and returns the local `User` row. Returns `null` if nobody is
 * signed in. This is the link between Clerk (auth source of truth) and our DB.
 */
export async function getOrCreateUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress ??
    null;

  // Many employees have no email. The local `User` mirror keys on a unique,
  // non-null email, so there's nothing to sync (and a blank email would collide
  // across emailless users). Skip — auth still works via Clerk + the Employee row.
  if (!email) return null;

  return prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
    },
    create: {
      clerkId: clerkUser.id,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      imageUrl: clerkUser.imageUrl,
    },
  });
}
