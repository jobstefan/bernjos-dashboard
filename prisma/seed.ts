import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Seed connects through the same driver adapter as the runtime client.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// All statutory rows share this effective date. A future rate change is a new
// batch of rows with a later effectiveDate — historical runs stay reproducible.
const EFFECTIVE = new Date("2025-01-01");

/**
 * SSS 2025 (RA 11199 schedule): 15% total contribution — 5% employee, 10%
 * employer. Monthly Salary Credit (MSC) ranges from ₱5,000 to ₱35,000 in ₱500
 * steps. Each compensation range maps to an MSC; the contribution is MSC × rate.
 */
function buildSssBrackets() {
  const rows: {
    effectiveDate: Date;
    minSalary: number;
    maxSalary: number;
    monthlyCredit: number;
    employeeShare: number;
    employerShare: number;
  }[] = [];

  const MSC_MIN = 5000;
  const MSC_MAX = 35000;
  const STEP = 500;

  for (let msc = MSC_MIN; msc <= MSC_MAX; msc += STEP) {
    const isFirst = msc === MSC_MIN;
    const isLast = msc === MSC_MAX;
    // Compensation range centred on the MSC: [msc-250, msc+250).
    const minSalary = isFirst ? 0 : msc - 250;
    const maxSalary = isLast ? 99_999_999.99 : msc + 250 - 0.01;
    rows.push({
      effectiveDate: EFFECTIVE,
      minSalary,
      maxSalary,
      monthlyCredit: msc,
      employeeShare: 0.05,
      employerShare: 0.1,
    });
  }
  return rows;
}

/**
 * PhilHealth 2025: 5% premium on monthly basic salary, split equally (employee
 * pays 2.5%). Income floor ₱10,000 (₱500 total premium), ceiling ₱100,000
 * (₱5,000 total premium).
 */
const PHILHEALTH_ROW = {
  effectiveDate: EFFECTIVE,
  minSalary: 10_000,
  maxSalary: 100_000,
  rate: 0.05,
  minContribution: 500,
  maxContribution: 5_000,
};

async function main() {
  console.log("Seeding statutory tables for effective date 2025-01-01…");

  // Idempotent: clear this effective batch, then re-insert.
  await prisma.$transaction([
    prisma.statutorySssBracket.deleteMany({ where: { effectiveDate: EFFECTIVE } }),
    prisma.statutoryPhilhealthBracket.deleteMany({ where: { effectiveDate: EFFECTIVE } }),
  ]);

  const sss = buildSssBrackets();

  await prisma.statutorySssBracket.createMany({ data: sss });
  await prisma.statutoryPhilhealthBracket.create({ data: PHILHEALTH_ROW });

  console.log(
    `Seeded: ${sss.length} SSS brackets, 1 PhilHealth row.`,
  );
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
