import "dotenv/config";
import { createClerkClient } from "@clerk/nextjs/server";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Seed login-capable Clerk users, one per role, so the app's RBAC can be
 * exercised end-to-end. Roles are stored in Clerk `publicMetadata.role` (the
 * source of truth read by `src/lib/auth/rbac.ts`). The `employee` user is also
 * linked to a local Employee record so self-service tabs (payslips, cash
 * advances) resolve.
 *
 * Idempotent: existing users (matched by email) are updated in place, so this
 * can be re-run safely. Requires CLERK_SECRET_KEY (a `sk_test_…` dev key).
 *
 * Run with: `pnpm db:seed:users`
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  throw new Error("CLERK_SECRET_KEY is required to seed Clerk users.");
}
const clerk = createClerkClient({ secretKey });

const PASSWORD = process.env.SEED_USER_PASSWORD ?? "Bernjos-Dev-2026!";

type Role = "super_admin" | "admin" | "manager" | "employee";

interface SeedUser {
  role: Role;
  email: string;
  username: string;
  /** Clerk fictional test number (`555-01xx`) — usable in dev instances. */
  phoneNumber: string;
  firstName: string;
  lastName: string;
  /** When set, a linked Employee profile is created/updated for this user. */
  employee?: {
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
    phoneNumber: "+12015550101",
    firstName: "Sam",
    lastName: "Superadmin",
  },
  {
    role: "admin",
    email: "admin+clerk_test@example.com",
    username: "admin",
    phoneNumber: "+12015550102",
    firstName: "Andy",
    lastName: "Admin",
  },
  {
    role: "manager",
    email: "manager+clerk_test@example.com",
    username: "manager",
    phoneNumber: "+12015550103",
    firstName: "Maria",
    lastName: "Manager",
  },
  {
    role: "employee",
    email: "employee+clerk_test@example.com",
    username: "employee",
    phoneNumber: "+12015550104",
    firstName: "Ellen",
    lastName: "Employee",
    employee: {
      employeeCode: "EMP-0001",
      position: "Staff",
      department: "Operations",
      basicSalary: 1000,
      payFrequency: "semi_monthly",
      dateHired: "2025-01-01",
    },
  },
];

/** Find an existing Clerk user by email, or create one. Returns the user id. */
async function upsertClerkUser(u: SeedUser): Promise<string> {
  const existing = await clerk.users.getUserList({ emailAddress: [u.email] });
  if (existing.data.length > 0) {
    const user = existing.data[0];
    await clerk.users.updateUserMetadata(user.id, {
      publicMetadata: { role: u.role },
    });
    console.log(`  ↻ updated ${u.email} (role=${u.role})`);
    return user.id;
  }

  const created = await clerk.users.createUser({
    emailAddress: [u.email],
    username: u.username,
    phoneNumber: [u.phoneNumber],
    password: PASSWORD,
    firstName: u.firstName,
    lastName: u.lastName,
    publicMetadata: { role: u.role },
    skipPasswordChecks: true,
  });
  console.log(`  ＋ created ${u.email} (role=${u.role})`);
  return created.id;
}

/** Mirror the Clerk user into the local User table (as getOrCreateUser would). */
async function upsertLocalUser(clerkId: string, u: SeedUser) {
  await prisma.user.upsert({
    where: { clerkId },
    update: { email: u.email, firstName: u.firstName, lastName: u.lastName },
    create: {
      clerkId,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
    },
  });
}

/** Create/update the linked Employee profile for a self-service user. */
async function upsertEmployee(clerkUserId: string, u: SeedUser) {
  if (!u.employee) return;
  const e = u.employee;
  await prisma.employee.upsert({
    where: { employeeCode: e.employeeCode },
    update: {
      clerkUserId,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      position: e.position,
      department: e.department,
      basicSalary: e.basicSalary,
      payFrequency: e.payFrequency,
      dateHired: new Date(e.dateHired),
      employmentStatus: "active",
      deletedAt: null,
    },
    create: {
      clerkUserId,
      employeeCode: e.employeeCode,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      position: e.position,
      department: e.department,
      basicSalary: e.basicSalary,
      payFrequency: e.payFrequency,
      dateHired: new Date(e.dateHired),
      employmentStatus: "active",
    },
  });
  console.log(`     ↳ linked Employee ${e.employeeCode}`);
}

async function main() {
  console.log("Seeding Clerk users for all roles…");
  for (const u of USERS) {
    const clerkId = await upsertClerkUser(u);
    await upsertLocalUser(clerkId, u);
    await upsertEmployee(clerkId, u);
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
