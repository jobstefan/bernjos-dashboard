import "dotenv/config";
import { createClerkClient } from "@clerk/nextjs/server";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Seed login-capable Clerk users, one per role, so the app's RBAC can be
 * exercised end-to-end. Roles are stored in the DB `User.role` column (the
 * source of truth). The `employee` user is also linked to a local UserProfile
 * record so self-service tabs (payslips, cash advances) resolve.
 *
 * Idempotent: existing users (matched by email) are updated in place, so this
 * can be re-run safely. Requires CLERK_SECRET_KEY (a `sk_test_…` dev key).
 *
 * Run with: `pnpm db:seed:users`
 */

// Prefer the DIRECT (non-pooled) connection; fall back to DATABASE_URL locally.
const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  throw new Error("CLERK_SECRET_KEY is required to seed Clerk users.");
}
const clerk = createClerkClient({ secretKey });

const PASSWORD = process.env.SEED_USER_PASSWORD ?? "Bernjos-Dev-2026!";

type DbRole = "super_admin" | "admin" | "manager" | "employee";

interface SeedUser {
  role: DbRole;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  /** When set, a linked UserProfile is created/updated for this user. */
  profile?: {
    employeeCode: string;
    position: string;
    department: string;
    /** Daily basic-pay rate. */
    basicSalary: number;
    payFrequency: "semi_monthly" | "monthly";
    dateHired: string;
  };
}

const USERS: SeedUser[] = [
  {
    role: "super_admin",
    email: "superadmin+clerk_test@example.com",
    username: "superadmin",
    firstName: "Sam",
    lastName: "Superadmin",
  },
  {
    role: "admin",
    email: "admin+clerk_test@example.com",
    username: "admin",
    firstName: "Andy",
    lastName: "Admin",
  },
  {
    role: "manager",
    email: "manager+clerk_test@example.com",
    username: "manager",
    firstName: "Maria",
    lastName: "Manager",
    profile: {
      employeeCode: "EMP-0002",
      position: "Team Lead",
      department: "Operations",
      basicSalary: 1500,
      payFrequency: "semi_monthly",
      dateHired: "2024-06-01",
    },
  },
  {
    role: "employee",
    email: "employee+clerk_test@example.com",
    username: "employee",
    firstName: "Ellen",
    lastName: "Employee",
    profile: {
      employeeCode: "EMP-0001",
      position: "Staff",
      department: "Operations",
      basicSalary: 1000,
      payFrequency: "semi_monthly",
      dateHired: "2025-01-01",
    },
  },
];

/** Find an existing Clerk user by email, or create one. Returns the Clerk user id. */
async function upsertClerkUser(u: SeedUser): Promise<string> {
  const existing = await clerk.users.getUserList({ emailAddress: [u.email] });
  if (existing.data.length > 0) {
    const user = existing.data[0];
    console.log(`  ↻ updated ${u.email} (role=${u.role} in DB)`);
    return user.id;
  }

  const created = await clerk.users.createUser({
    emailAddress: [u.email],
    username: u.username,
    password: PASSWORD,
    firstName: u.firstName,
    lastName: u.lastName,
    publicMetadata: { needsOnboarding: true },
    skipPasswordChecks: true,
  });
  console.log(`  ＋ created ${u.email} (role=${u.role} in DB)`);
  return created.id;
}

/** Mirror the Clerk user into the local User table with the correct DB role. */
async function upsertLocalUser(clerkId: string, u: SeedUser) {
  return prisma.user.upsert({
    where: { clerkId },
    update: { email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role },
    create: {
      clerkId,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
    },
  });
}

/** Create/update the linked UserProfile for a self-service user. */
async function upsertUserProfile(userId: string, u: SeedUser) {
  if (!u.profile) return;
  const p = u.profile;
  await prisma.userProfile.upsert({
    where: { employeeCode: p.employeeCode },
    update: {
      userId,
      firstName: u.firstName,
      lastName: u.lastName,
      position: p.position,
      department: p.department,
      basicSalary: p.basicSalary,
      payFrequency: p.payFrequency,
      dateHired: new Date(p.dateHired),
      employmentStatus: "active",
      deletedAt: null,
    },
    create: {
      userId,
      employeeCode: p.employeeCode,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      position: p.position,
      department: p.department,
      basicSalary: p.basicSalary,
      payFrequency: p.payFrequency,
      dateHired: new Date(p.dateHired),
      employmentStatus: "active",
    },
  });
  console.log(`     ↳ linked UserProfile ${p.employeeCode}`);
}

async function main() {
  console.log("Seeding Clerk users for all roles…");
  for (const u of USERS) {
    const clerkId = await upsertClerkUser(u);
    const dbUser = await upsertLocalUser(clerkId, u);
    await upsertUserProfile(dbUser.id, u);
  }

  console.log("\nDone. Sign in at /sign-in with any of:");
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(11)} ${u.email}`);
  }
  console.log(`\nPassword for all seeded users: ${PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
