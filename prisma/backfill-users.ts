/**
 * One-time script: for every UserProfile with no linked User row, look up the
 * employee in Clerk by username, create (or find) the DB User record, and link
 * UserProfile.userId to it.
 *
 * Safe to re-run — all writes are upserts or conditional updates.
 *
 * Run with:
 *   pnpm tsx prisma/backfill-users.ts
 *
 * Against staging/prod, set the relevant env vars first:
 *   CLERK_SECRET_KEY=sk_... DIRECT_URL=postgresql://... pnpm tsx prisma/backfill-users.ts
 */

import "dotenv/config";
import { createClerkClient } from "@clerk/nextjs/server";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error("CLERK_SECRET_KEY is required.");
const clerk = createClerkClient({ secretKey });

async function main() {
  const orphans = await prisma.userProfile.findMany({
    where: { userId: null, deletedAt: null },
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      username: true,
    },
    orderBy: { employeeCode: "asc" },
  });

  console.log(`Found ${orphans.length} UserProfile(s) with no linked User.\n`);

  let linked = 0;
  let skipped = 0;

  for (const profile of orphans) {
    process.stdout.write(`  ${profile.employeeCode} (${profile.firstName} ${profile.lastName})`);

    if (!profile.username) {
      console.log(" — no username, skipping");
      skipped++;
      continue;
    }

    // Look up in Clerk by username
    const result = await clerk.users.getUserList({ username: [profile.username] });
    const clerkUser = result.data[0];

    if (!clerkUser) {
      console.log(` — not found in Clerk (username: ${profile.username}), skipping`);
      skipped++;
      continue;
    }

    const primaryEmail = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress ?? null;

    // Upsert DB User row
    const dbUser = await prisma.user.upsert({
      where: { clerkId: clerkUser.id },
      update: {
        email: primaryEmail,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl ?? null,
      },
      create: {
        clerkId: clerkUser.id,
        email: primaryEmail,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        imageUrl: clerkUser.imageUrl ?? null,
        role: "employee",
      },
    });

    // Link the profile
    await prisma.userProfile.update({
      where: { id: profile.id },
      data: { userId: dbUser.id },
    });

    console.log(` → linked to User ${dbUser.id} (${primaryEmail ?? "no email"})`);
    linked++;
  }

  console.log(`\nDone. Linked: ${linked}, Skipped: ${skipped}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
