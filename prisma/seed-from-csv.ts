import "dotenv/config";
import * as XLSX from "xlsx";
import * as path from "path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { createClerkClient } from "@clerk/nextjs/server";

// Prefer the DIRECT (non-pooled) connection; fall back to DATABASE_URL locally.
const adapter = new PrismaPg({
  connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error("CLERK_SECRET_KEY is required.");
const clerk = createClerkClient({ secretKey });

const TEMP_PASSWORD = process.env.EMPLOYEE_TEMP_PASSWORD ?? "1234";
const DATE_HIRED = new Date("2026-08-24");

// Known CSV typos: keyed by employee code string
const NAME_CORRECTIONS: Record<string, { firstName?: string; lastName?: string }> = {
  "1002": { lastName: "Calacar" },
};

// Inline from src/lib/auth/username.ts (can't import server-only)
function sanitize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ñ/gi, "n")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildUsername(firstName: string, lastName: string): string {
  const firstInitials = firstName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t[0])
    .join("");
  return sanitize(firstInitials + lastName);
}

async function uniqueUsername(base: string, employeeCode: string): Promise<string> {
  const MIN_LEN = 4;
  let candidate = base;
  if (candidate.length < MIN_LEN) {
    const fallback = sanitize(employeeCode);
    candidate =
      fallback.length >= MIN_LEN
        ? fallback
        : (candidate + fallback).padEnd(MIN_LEN, "0");
  }
  const root = candidate;
  for (let suffix = 0; ; suffix++) {
    const name = suffix === 0 ? root : `${root}${suffix + 1}`;
    const existing = await prisma.employee.findFirst({ where: { username: name } });
    if (!existing) return name;
  }
}

interface CsvRow {
  employeeCode: string;
  firstName: string;
  lastName: string;
  dailyRate: number;
}

function parseCsv(): CsvRow[] {
  const filePath = path.resolve(
    __dirname,
    "../sample-sheets/employees_list - Names List.csv"
  );
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

  const rows: CsvRow[] = [];
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    const code = row[0];
    const rawName = row[1];
    const rawRate = row[2];

    if (!code || !rawName) continue;
    if (!rawRate) continue; // skip no daily rate

    const rate = typeof rawRate === "number" ? rawRate : parseFloat(String(rawRate).replace(/[^\d.]/g, ""));
    if (!rate || isNaN(rate)) continue;

    const codeStr = String(code);
    let firstName = "";
    let lastName = "";

    const nameStr = String(rawName).trim();
    if (nameStr.includes(",")) {
      const [last, first] = nameStr.split(",");
      lastName = last.trim();
      firstName = first.trim();
    } else {
      const parts = nameStr.split(/\s+/);
      lastName = parts[0];
      firstName = parts.slice(1).join(" ");
    }

    // Apply known corrections
    const correction = NAME_CORRECTIONS[codeStr];
    if (correction?.lastName) lastName = correction.lastName;
    if (correction?.firstName) firstName = correction.firstName;

    rows.push({ employeeCode: codeStr, firstName, lastName, dailyRate: rate });
  }
  return rows;
}

async function main() {
  const rows = parseCsv();
  console.log(`\nFound ${rows.length} employees with daily rates. Importing…\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const { employeeCode, firstName, lastName, dailyRate } = row;
    try {
      const existing = await prisma.employee.findUnique({ where: { employeeCode } });

      let clerkUserId = existing?.clerkUserId ?? null;
      let username = existing?.username ?? null;

      if (!clerkUserId) {
        username = await uniqueUsername(buildUsername(firstName, lastName), employeeCode);
        const clerkUser = await clerk.users.createUser({
          username,
          password: TEMP_PASSWORD,
          skipPasswordChecks: true,
          firstName,
          lastName,
          publicMetadata: { role: "employee", needsOnboarding: true },
        });
        clerkUserId = clerkUser.id;
      }

      const employee = await prisma.employee.upsert({
        where: { employeeCode },
        create: {
          employeeCode,
          firstName,
          lastName,
          username: username!,
          clerkUserId,
          basicSalary: dailyRate,
          position: "Employee",
          department: "General",
          dateHired: DATE_HIRED,
          employmentStatus: "active",
          payFrequency: "semi_monthly",
        },
        update: {
          firstName,
          lastName,
          basicSalary: dailyRate,
          ...(clerkUserId && !existing?.clerkUserId ? { clerkUserId, username: username! } : {}),
        },
      });

      await prisma.savingsAccount.upsert({
        where: { employeeId: employee.id },
        create: { employeeId: employee.id, contributionAmount: 100, createdBy: "seed-from-csv" },
        update: {},
      });

      if (existing) {
        console.log(`  updated  ${employeeCode} — ${lastName}, ${firstName}`);
        updated++;
      } else {
        console.log(`  created  ${employeeCode} — ${lastName}, ${firstName}  (username: ${username})`);
        created++;
      }
    } catch (err) {
      console.error(`  ERROR    ${employeeCode} — ${lastName}, ${firstName}:`, err instanceof Error ? err.message : err);
      errors++;
    }
  }

  console.log(`\nDone. created=${created} updated=${updated} errors=${errors}\n`);
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
