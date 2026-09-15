import "dotenv/config";
import { createClerkClient } from "@clerk/nextjs/server";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Master dev seed — covers every scenario needed to exercise the full app:
 *   1. Government contribution tables (SSS, PhilHealth)
 *   2. Reference data (departments, positions, branches)
 *   3. Clerk auth users, one per DB role, with linked UserProfile records
 *   4. Payroll periods in each lifecycle stage (draft, approved, paid)
 *   5. Payroll run items for seeded employee/manager profiles
 *   6. Cash advances in each status (pending, approved, declined, applied)
 *   7. Schedule entries for the current demo week
 *
 * Idempotent: safe to re-run. Requires CLERK_SECRET_KEY.
 * Run with: `pnpm db:seed:dev`
 */

const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// Clerk is optional for dev seeding. When DEV_AUTH is on, or no secret key is
// set, or the Clerk API is unreachable/invalid, we fall back to deterministic
// `dev_<role>` clerk ids that match the dev-session login (see
// src/app/actions/dev-auth.actions.ts) so the full seed still runs.
const secretKey = process.env.CLERK_SECRET_KEY;
const useClerk = process.env.DEV_AUTH !== "true" && Boolean(secretKey);
const clerk = useClerk ? createClerkClient({ secretKey: secretKey! }) : null;

const PASSWORD = process.env.SEED_USER_PASSWORD ?? "Bernjos-Dev-2026!";

// ─── 1. Reference data ────────────────────────────────────────────────────────

async function seedReferenceData() {
  console.log("\n[1/6] Reference data…");

  const [baking, deli, operations, administration] = await Promise.all([
    prisma.department.upsert({ where: { name: "Baking" }, update: {}, create: { name: "Baking" } }),
    prisma.department.upsert({ where: { name: "Deli" }, update: {}, create: { name: "Deli" } }),
    prisma.department.upsert({ where: { name: "Operations" }, update: {}, create: { name: "Operations" } }),
    prisma.department.upsert({ where: { name: "Administration" }, update: {}, create: { name: "Administration" } }),
  ]);
  console.log("  ✓ 4 departments");

  await Promise.all([
    prisma.position.upsert({
      where: { departmentId_name: { departmentId: baking.id, name: "Baker" } },
      update: {},
      create: { name: "Baker", departmentId: baking.id },
    }),
    prisma.position.upsert({
      where: { departmentId_name: { departmentId: deli.id, name: "Deli Staff" } },
      update: {},
      create: { name: "Deli Staff", departmentId: deli.id },
    }),
    prisma.position.upsert({
      where: { departmentId_name: { departmentId: operations.id, name: "Team Lead" } },
      update: {},
      create: { name: "Team Lead", departmentId: operations.id },
    }),
    prisma.position.upsert({
      where: { departmentId_name: { departmentId: operations.id, name: "Staff" } },
      update: {},
      create: { name: "Staff", departmentId: operations.id },
    }),
    prisma.position.upsert({
      where: { departmentId_name: { departmentId: administration.id, name: "HR Officer" } },
      update: {},
      create: { name: "HR Officer", departmentId: administration.id },
    }),
  ]);
  console.log("  ✓ 5 positions");

  // Branch has no unique constraint on name — check before create
  const mainBranch =
    (await prisma.branch.findFirst({ where: { name: "Main Branch" } })) ??
    (await prisma.branch.create({
      data: { name: "Main Branch", address: "123 Bakery St", attendanceFormat: "zkteco-v1" },
    }));
  const deliBranch =
    (await prisma.branch.findFirst({ where: { name: "Deli Branch" } })) ??
    (await prisma.branch.create({
      data: { name: "Deli Branch", address: "456 Deli Ave", attendanceFormat: "deli-v1" },
    }));
  console.log("  ✓ 2 branches");

  return { mainBranch, deliBranch };
}

// ─── 3. Auth users ────────────────────────────────────────────────────────────

type DbRole = "super_admin" | "admin" | "manager" | "employee";

interface SeedUser {
  role: DbRole;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  profile?: {
    employeeCode: string;
    position: string;
    department: string;
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

async function upsertClerkUser(u: SeedUser): Promise<string> {
  if (clerk) {
    try {
      const existing = await clerk.users.getUserList({ emailAddress: [u.email] });
      if (existing.data.length > 0) {
        console.log(`  ↻ ${u.email}`);
        return existing.data[0].id;
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
      console.log(`  ＋ ${u.email}`);
      return created.id;
    } catch (e) {
      console.log(`  ⚠ Clerk unavailable for ${u.email} (${(e as Error).message}). Using dev id.`);
    }
  }
  // No-Clerk fallback: deterministic id matching the dev-session login.
  const devId = `dev_${u.role}`;
  console.log(`  ﹫ ${u.email} → ${devId} (dev-session login)`);
  return devId;
}

async function seedUsers() {
  console.log("\n[2/6] Auth users…");

  const result = {} as Record<DbRole, { clerkId: string; userId: string; profileId: string | null }>;

  for (const u of USERS) {
    const clerkId = await upsertClerkUser(u);

    const dbUser = await prisma.user.upsert({
      where: { clerkId },
      update: { email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role },
      create: { clerkId, email: u.email, firstName: u.firstName, lastName: u.lastName, role: u.role },
    });

    let profileId: string | null = null;
    if (u.profile) {
      const p = u.profile;
      const profile = await prisma.userProfile.upsert({
        where: { employeeCode: p.employeeCode },
        update: {
          userId: dbUser.id,
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
          userId: dbUser.id,
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
      profileId = profile.id;

      await prisma.savingsAccount.upsert({
        where: { profileId: profile.id },
        update: {},
        create: { profileId: profile.id, contributionAmount: 100, createdBy: "seed" },
      });
      console.log(`     ↳ profile ${p.employeeCode} + savings account`);
    }

    result[u.role] = { clerkId, userId: dbUser.id, profileId };
  }

  return result;
}

// ─── 4 & 5. Payroll periods + run items ──────────────────────────────────────

async function seedPayroll(employeeProfileId: string, managerProfileId: string) {
  console.log("\n[3/6] Payroll periods…");

  const upsertPeriod = async (
    data: Parameters<typeof prisma.payrollPeriod.create>[0]["data"] & { periodLabel: string },
  ) => {
    const existing = await prisma.payrollPeriod.findFirst({
      where: { periodLabel: data.periodLabel, deletedAt: null },
    });
    return existing ?? (await prisma.payrollPeriod.create({ data }));
  };

  const paid = await upsertPeriod({
    periodLabel: "Dec 1–15, 2025",
    periodStart: new Date("2025-12-01"),
    periodEnd: new Date("2025-12-15"),
    payDate: new Date("2025-12-20"),
    frequency: "semi_monthly",
    status: "paid",
    createdBy: "seed",
    approvedBy: "seed",
    approvedAt: new Date("2025-12-17"),
    paidBy: "seed",
    paidAt: new Date("2025-12-20"),
  });

  const approved = await upsertPeriod({
    periodLabel: "Jan 1–15, 2026",
    periodStart: new Date("2026-01-01"),
    periodEnd: new Date("2026-01-15"),
    payDate: new Date("2026-01-20"),
    frequency: "semi_monthly",
    status: "approved",
    createdBy: "seed",
    approvedBy: "seed",
    approvedAt: new Date("2026-01-17"),
  });

  const draft = await upsertPeriod({
    periodLabel: "Aug 1–15, 2026",
    periodStart: new Date("2026-08-01"),
    periodEnd: new Date("2026-08-15"),
    payDate: new Date("2026-08-20"),
    frequency: "semi_monthly",
    status: "draft",
    createdBy: "seed",
  });

  console.log("  ✓ paid, approved, draft");
  console.log("\n[4/6] Payroll run items…");

  const upsertRunItem = (
    payrollPeriodId: string,
    profileId: string,
    fields: {
      basicSalary: number;
      grossPay: number;
      sssEmployee: number;
      philhealthEmployee: number;
      savingsContribution: number;
      totalDeductions: number;
      netPay: number;
    },
  ) =>
    prisma.payrollRunItem.upsert({
      where: { payrollPeriodId_profileId: { payrollPeriodId, profileId } },
      update: {},
      create: { payrollPeriodId, profileId, status: "included", ...fields },
    });

  // Employee: ₱1,000/day × 13 days = ₱13,000 gross
  // SSS (semi-monthly, monthly equiv ₱26,000 → MSC 26,000): ₱650 employee
  // PhilHealth (₱26,000 × 5% / 2): ₱325 employee
  const emp = { basicSalary: 1000, grossPay: 13000, sssEmployee: 650, philhealthEmployee: 325, savingsContribution: 100, totalDeductions: 975, netPay: 11925 };

  // Manager: ₱1,500/day × 13 days = ₱19,500 gross
  // SSS (monthly equiv ₱39,000 → MSC capped at ₱35,000): ₱875 employee
  // PhilHealth (₱39,000 × 5% / 2): ₱487.50 employee
  const mgr = { basicSalary: 1500, grossPay: 19500, sssEmployee: 875, philhealthEmployee: 487.5, savingsContribution: 0, totalDeductions: 1362.5, netPay: 18137.5 };

  for (const periodId of [paid.id, approved.id, draft.id]) {
    await upsertRunItem(periodId, employeeProfileId, emp);
    await upsertRunItem(periodId, managerProfileId, mgr);
  }
  console.log("  ✓ 6 run items (employee + manager × 3 periods)");

  return { paidPeriodId: paid.id, approvedPeriodId: approved.id, draftPeriodId: draft.id };
}

// ─── 6. Cash advances ─────────────────────────────────────────────────────────

async function seedCashAdvances(
  employeeProfileId: string,
  employeeClerkId: string,
  adminClerkId: string,
  paidPeriodId: string,
) {
  console.log("\n[5/6] Cash advances…");

  await prisma.cashAdvance.createMany({
    data: [
      {
        profileId: employeeProfileId,
        amount: 2000,
        reason: "Emergency home repair",
        status: "pending",
        requestedBy: employeeClerkId,
      },
      {
        profileId: employeeProfileId,
        amount: 3000,
        approvedAmount: 2500,
        reason: "Medical expenses",
        status: "approved",
        requestedBy: employeeClerkId,
        decidedBy: adminClerkId,
        decidedAt: new Date("2026-07-10"),
        decisionNote: "Approved partial amount per policy.",
      },
      {
        profileId: employeeProfileId,
        amount: 5000,
        reason: "Personal travel",
        status: "declined",
        requestedBy: employeeClerkId,
        decidedBy: adminClerkId,
        decidedAt: new Date("2026-06-15"),
        decisionNote: "Insufficient tenure for this amount.",
      },
      {
        profileId: employeeProfileId,
        amount: 1000,
        approvedAmount: 1000,
        reason: "Advance on salary",
        status: "applied",
        requestedBy: employeeClerkId,
        decidedBy: adminClerkId,
        decidedAt: new Date("2025-12-05"),
        decisionNote: "Approved.",
        appliedPeriodId: paidPeriodId,
        appliedAt: new Date("2025-12-20"),
      },
    ],
  });
  console.log("  ✓ 4 cash advances (pending, approved, declined, applied)");
}

// ─── 6b. Savings transactions ─────────────────────────────────────────────────

async function seedSavingsTransactions(
  employeeProfileId: string,
  paidPeriodId: string,
  approvedPeriodId: string,
) {
  const account = await prisma.savingsAccount.findUnique({ where: { profileId: employeeProfileId } });
  if (!account) return;

  await prisma.savingsTransaction.createMany({
    data: [
      {
        accountId: account.id,
        type: "contribution",
        amount: 100,
        note: "Payroll deduction",
        appliedPeriodId: paidPeriodId,
        createdBy: "seed",
      },
      {
        accountId: account.id,
        type: "contribution",
        amount: 100,
        note: "Payroll deduction",
        appliedPeriodId: approvedPeriodId,
        createdBy: "seed",
      },
    ],
  });
  console.log("  ✓ 2 savings transactions");
}

// ─── 7. Schedule entries ──────────────────────────────────────────────────────

// Week of 2026-08-24 (Mon–Sat)
const SCHEDULE_WEEK = [
  new Date("2026-08-24"),
  new Date("2026-08-25"),
  new Date("2026-08-26"),
  new Date("2026-08-27"),
  new Date("2026-08-28"),
  new Date("2026-08-29"),
];

async function seedSchedule(
  employeeProfileId: string,
  managerProfileId: string,
  branchId: string,
) {
  console.log("\n[6/6] Schedule entries (week of 2026-08-24)…");

  let count = 0;
  for (const date of SCHEDULE_WEEK) {
    for (const profileId of [employeeProfileId, managerProfileId]) {
      await prisma.scheduleEntry.upsert({
        where: { date_profileId: { date, profileId } },
        update: {},
        create: { date, profileId, branchId, startTime: "08:00", endTime: "17:00", createdBy: "seed" },
      });
      count++;
    }
  }
  console.log(`  ✓ ${count} schedule entries`);
}

// ─── 8. Inventory module — all scenarios ──────────────────────────────────────

/** UTC-midnight date `offsetDays` from today (matches @db.Date session storage). */
function utcMidnight(offsetDays: number): Date {
  const n = new Date();
  const d = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d;
}

async function seedInventory(opts: {
  mainBranchId: string;
  deliBranchId: string;
  employeeProfileId: string;
  employeeClerkId: string;
  managerProfileId: string;
  managerClerkId: string;
  adminClerkId: string;
}) {
  console.log("\n[7/7] Inventory module…");
  const { mainBranchId, deliBranchId, employeeClerkId, managerClerkId, adminClerkId } = opts;

  // Categories (sale + production)
  const cat = (name: string) => prisma.productCategory.create({ data: { name } });
  const [bread, pastries, drinks, dryGoods, dairy, packaging] = await Promise.all([
    cat("Bread"), cat("Pastries"), cat("Drinks"), cat("Dry Goods"), cat("Dairy"), cat("Packaging"),
  ]);

  // Products — sale items priced, production items unpriced
  const product = (
    name: string, unit: string, type: "sale" | "production", categoryId: string, price: number | null,
  ) => prisma.product.create({ data: { name, unit, type, categoryId, price, createdBy: "seed" } });
  const [pandesal, ensaymada, water, flour, sugar, butter, boxes] = await Promise.all([
    product("Pandesal", "pc", "sale", bread.id, 3),
    product("Ensaymada", "pc", "sale", pastries.id, 25),
    product("Bottled Water", "bottle", "sale", drinks.id, 20),
    product("Flour", "kg", "production", dryGoods.id, null),
    product("Sugar", "kg", "production", dryGoods.id, null),
    product("Butter", "block", "production", dairy.id, null),
    product("Boxes", "pc", "production", packaging.id, null),
  ]);

  // Per-branch reorder thresholds (some deliberately above on-hand → low-stock)
  await prisma.branchProductThreshold.createMany({
    data: [
      { branchId: mainBranchId, productId: pandesal.id, reorderThreshold: 50 },
      { branchId: mainBranchId, productId: ensaymada.id, reorderThreshold: 20 },
      { branchId: mainBranchId, productId: water.id, reorderThreshold: 30 },
      { branchId: mainBranchId, productId: flour.id, reorderThreshold: 10 },
      { branchId: deliBranchId, productId: pandesal.id, reorderThreshold: 40 },
      { branchId: deliBranchId, productId: water.id, reorderThreshold: 25 },
    ],
  });

  // Yesterday's CLOSED session (main) → derived usage for reports/corrections
  const ySession = await prisma.inventorySession.create({
    data: {
      branchId: mainBranchId, sessionDate: utcMidnight(-1),
      openedBy: employeeClerkId, closedBy: employeeClerkId, closedAt: new Date(),
    },
  });
  await prisma.inventoryEntry.createMany({
    data: [
      { sessionId: ySession.id, productId: pandesal.id, type: "opening", quantity: 100, enteredBy: employeeClerkId },
      { sessionId: ySession.id, productId: pandesal.id, type: "restock", quantity: 50, enteredBy: employeeClerkId },
      { sessionId: ySession.id, productId: pandesal.id, type: "wastage", quantity: 5, wastageReason: "expired", enteredBy: employeeClerkId },
      { sessionId: ySession.id, productId: pandesal.id, type: "closing", quantity: 40, enteredBy: employeeClerkId },
      { sessionId: ySession.id, productId: ensaymada.id, type: "opening", quantity: 30, enteredBy: employeeClerkId },
      { sessionId: ySession.id, productId: ensaymada.id, type: "restock", quantity: 10, enteredBy: employeeClerkId },
      { sessionId: ySession.id, productId: ensaymada.id, type: "closing", quantity: 15, enteredBy: employeeClerkId },
      { sessionId: ySession.id, productId: flour.id, type: "opening", quantity: 20, enteredBy: employeeClerkId },
      { sessionId: ySession.id, productId: flour.id, type: "wastage", quantity: 2, wastageReason: "damaged", enteredBy: employeeClerkId },
      { sessionId: ySession.id, productId: flour.id, type: "closing", quantity: 15, enteredBy: employeeClerkId },
    ],
  });

  // Today's OPEN session (main), with a mid-day operator handoff + low stock
  const tSession = await prisma.inventorySession.create({
    data: { branchId: mainBranchId, sessionDate: utcMidnight(0), openedBy: employeeClerkId },
  });
  const hrs = (h: number) => new Date(Date.now() - h * 3600_000);
  await prisma.inventorySessionOperator.createMany({
    data: [
      { sessionId: tSession.id, operatorId: employeeClerkId, startedAt: hrs(6), endedAt: hrs(3) },
      { sessionId: tSession.id, operatorId: managerClerkId, startedAt: hrs(3) },
    ],
  });
  await prisma.inventoryEntry.createMany({
    data: [
      // Pandesal opens at 40 (< par 50) and Bottled Water at 10 (< par 30) → low-stock flags
      { sessionId: tSession.id, productId: pandesal.id, type: "opening", quantity: 40, enteredBy: employeeClerkId },
      { sessionId: tSession.id, productId: pandesal.id, type: "restock", quantity: 20, enteredBy: managerClerkId },
      { sessionId: tSession.id, productId: water.id, type: "opening", quantity: 10, enteredBy: employeeClerkId },
      { sessionId: tSession.id, productId: ensaymada.id, type: "opening", quantity: 15, enteredBy: employeeClerkId },
      { sessionId: tSession.id, productId: ensaymada.id, type: "wastage", quantity: 1, wastageReason: "damaged", enteredBy: managerClerkId },
    ],
  });

  // Deli today session — hosts the outgoing (bst_out) transfer entries
  const dSession = await prisma.inventorySession.create({
    data: { branchId: deliBranchId, sessionDate: utcMidnight(0), openedBy: managerClerkId },
  });

  // BST across every state (source = Deli, dest = Main)
  const line = (productId: string, requestedQty: number, extra: object = {}) => ({ productId, requestedQty, ...extra });
  await prisma.stockTransfer.create({
    data: { sourceBranchId: deliBranchId, destBranchId: mainBranchId, status: "requested", requestedBy: employeeClerkId, lines: { create: [line(pandesal.id, 20)] } },
  });
  await prisma.stockTransfer.create({
    data: { sourceBranchId: deliBranchId, destBranchId: mainBranchId, status: "approved", requestedBy: employeeClerkId, approvedBy: adminClerkId, approvedAt: new Date(), lines: { create: [line(water.id, 15)] } },
  });
  const prepared = await prisma.stockTransfer.create({
    data: { sourceBranchId: deliBranchId, destBranchId: mainBranchId, status: "prepared", requestedBy: employeeClerkId, approvedBy: adminClerkId, approvedAt: hrs(5), preparedBy: managerClerkId, preparedAt: new Date(), lines: { create: [line(flour.id, 10, { preparedQty: 10 })] } },
  });
  await prisma.inventoryEntry.create({
    data: { sessionId: dSession.id, productId: flour.id, type: "bst_out", quantity: 10, bstId: prepared.id, enteredBy: managerClerkId },
  });
  const received = await prisma.stockTransfer.create({
    data: { sourceBranchId: deliBranchId, destBranchId: mainBranchId, status: "received", requestedBy: employeeClerkId, approvedBy: adminClerkId, approvedAt: hrs(8), preparedBy: managerClerkId, preparedAt: hrs(5), receivedBy: employeeClerkId, receivedAt: new Date(), lines: { create: [line(sugar.id, 10, { preparedQty: 10, receivedQty: 8 })] } },
  });
  await prisma.inventoryEntry.createMany({
    data: [
      { sessionId: dSession.id, productId: sugar.id, type: "bst_out", quantity: 10, bstId: received.id, enteredBy: managerClerkId },
      { sessionId: tSession.id, productId: sugar.id, type: "bst_in", quantity: 8, bstId: received.id, enteredBy: employeeClerkId },
    ],
  });
  await prisma.stockTransfer.create({
    data: { sourceBranchId: deliBranchId, destBranchId: mainBranchId, status: "declined", requestedBy: employeeClerkId, approvedBy: adminClerkId, approvedAt: new Date(), decisionNote: "Source is out of stock.", lines: { create: [line(boxes.id, 5)] } },
  });

  // Cash advances (branch-tagged) — approved-unreleased + released-unapplied
  await prisma.cashAdvance.create({
    data: { profileId: opts.employeeProfileId, branchId: mainBranchId, amount: 2000, approvedAmount: 2000, reason: "Uniform allowance", status: "approved", requestedBy: employeeClerkId, decidedBy: adminClerkId, decidedAt: new Date(), slipNumber: "CA-INV-000901" },
  });
  await prisma.cashAdvance.create({
    data: { profileId: opts.managerProfileId, branchId: mainBranchId, amount: 1500, approvedAmount: 1500, reason: "Transport", status: "approved", requestedBy: managerClerkId, decidedBy: adminClerkId, decidedAt: hrs(48), releasedAt: new Date(), releasedBy: managerClerkId, releaseBranchId: mainBranchId, slipNumber: "CA-INV-000902" },
  });

  // Loans — approved (awaiting release) + active (released, with repayments)
  await prisma.loan.create({
    data: { profileId: opts.employeeProfileId, branchId: mainBranchId, amount: 3000, termPeriods: 3, reason: "Appliance", status: "approved", requestedBy: employeeClerkId, decidedBy: adminClerkId, decidedAt: new Date(), slipNumber: "LN-INV-000901" },
  });
  const activeLoan = await prisma.loan.create({
    data: { profileId: opts.managerProfileId, branchId: mainBranchId, amount: 2000, termPeriods: 2, reason: "Tuition", status: "active", requestedBy: managerClerkId, decidedBy: adminClerkId, decidedAt: hrs(72), disbursedBy: managerClerkId, disbursedAt: new Date(), releaseBranchId: mainBranchId, slipNumber: "LN-INV-000902" },
  });
  await prisma.loanRepayment.createMany({
    data: [
      { loanId: activeLoan.id, installmentNo: 1, amount: 1000 },
      { loanId: activeLoan.id, installmentNo: 2, amount: 1000 },
    ],
  });

  console.log("  ✓ 6 categories, 7 products, 6 thresholds, 3 sessions (1 closed + handoff), 5 transfers (incl. discrepancy), release-gate advances + loans");
}

// ─── 0. Clear existing data ───────────────────────────────────────────────────

async function clearData() {
  console.log("\n[0/7] Clearing existing data…");
  // Delete in FK dependency order: children before parents
  await prisma.$transaction([
    // Inventory module (children → parents), before branch/product deletes below.
    prisma.inventoryEntry.deleteMany(),
    prisma.inventorySessionOperator.deleteMany(),
    prisma.inventorySession.deleteMany(),
    prisma.stockTransferLine.deleteMany(),
    prisma.stockTransfer.deleteMany(),
    prisma.branchProductThreshold.deleteMany(),
    prisma.product.deleteMany(),
    prisma.productCategory.deleteMany(),
    prisma.loanRepayment.deleteMany(),
    prisma.loan.deleteMany(),
    prisma.savingsTransaction.deleteMany(),
    prisma.savingsAccount.deleteMany(),
    prisma.cashAdvance.deleteMany(),
    prisma.payrollRunItemBranch.deleteMany(),
    prisma.payrollRunItem.deleteMany(),
    prisma.attendanceRecord.deleteMany(),
    prisma.attendanceImport.deleteMany(),
    prisma.scheduleEntry.deleteMany(),
    prisma.absenceRequest.deleteMany(),
    prisma.employeeDevice.deleteMany(),
    prisma.payrollPeriod.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.userProfile.deleteMany(),
    prisma.user.deleteMany(),
    prisma.position.deleteMany(),
    prisma.department.deleteMany(),
    prisma.branch.deleteMany(),
    // statutory_sss_brackets and statutory_philhealth_brackets are owned by
    // migrations — do not wipe them here.
  ]);
  console.log("  ✓ all tables cleared");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Bernjos dev seed — all scenarios…");

  await clearData();
  const { mainBranch, deliBranch } = await seedReferenceData();
  const users = await seedUsers();

  const employeeProfileId = users.employee.profileId!;
  const managerProfileId = users.manager.profileId!;

  const { paidPeriodId, approvedPeriodId } = await seedPayroll(
    employeeProfileId,
    managerProfileId,
  );

  await seedCashAdvances(
    employeeProfileId,
    users.employee.clerkId,
    users.admin.clerkId,
    paidPeriodId,
  );

  await seedSavingsTransactions(employeeProfileId, paidPeriodId, approvedPeriodId);

  await seedSchedule(employeeProfileId, managerProfileId, mainBranch.id);

  await seedInventory({
    mainBranchId: mainBranch.id,
    deliBranchId: deliBranch.id,
    employeeProfileId,
    employeeClerkId: users.employee.clerkId,
    managerProfileId,
    managerClerkId: users.manager.clerkId,
    adminClerkId: users.admin.clerkId,
  });

  console.log("\nDone. Sign in at /sign-in:");
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(11)} ${u.email}`);
  }
  console.log(`Password: ${PASSWORD}`);
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
