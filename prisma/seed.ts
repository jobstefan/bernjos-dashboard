import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Seed connects through the same driver adapter as the runtime client.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// All statutory rows share this effective date. A future rate change is a new
// batch of rows with a later effectiveDate — historical runs stay reproducible.
const EFFECTIVE = new Date("2025-01-01");

const TAX_STATUSES = [
  "S",
  "S1",
  "S2",
  "S3",
  "S4",
  "ME",
  "ME1",
  "ME2",
  "ME3",
  "ME4",
] as const;

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

/**
 * Pag-IBIG 2025: employee 1% (≤₱1,500) or 2% (>₱1,500); employer 2%. The base is
 * capped at a ₱5,000 monthly compensation, so the max employee share is ₱100.
 */
const PAGIBIG_ROWS = [
  {
    effectiveDate: EFFECTIVE,
    minSalary: 0,
    maxSalary: 1_500,
    employeeRate: 0.01,
    employerRate: 0.02,
    maxContribution: 100,
  },
  {
    effectiveDate: EFFECTIVE,
    minSalary: 1_500.01,
    maxSalary: 99_999_999.99,
    employeeRate: 0.02,
    employerRate: 0.02,
    maxContribution: 100,
  },
];

/**
 * BIR withholding tax (TRAIN Law, table effective Jan 2023 onward). Personal
 * exemptions were removed, so the brackets no longer vary by civil status — but
 * the schema keys on tax_status, so the same brackets are stored for each.
 */
const BIR_MONTHLY = [
  { min: 0, max: 20_833, base: 0, over: 0, rate: 0 },
  { min: 20_833, max: 33_332.99, base: 0, over: 20_833, rate: 0.15 },
  { min: 33_333, max: 66_666.99, base: 2_500, over: 33_333, rate: 0.2 },
  { min: 66_667, max: 166_666.99, base: 10_000, over: 66_667, rate: 0.25 },
  { min: 166_667, max: 666_666.99, base: 40_833.33, over: 166_667, rate: 0.3 },
  {
    min: 666_667,
    max: 99_999_999.99,
    base: 200_833.33,
    over: 666_667,
    rate: 0.35,
  },
];

const BIR_SEMI_MONTHLY = [
  { min: 0, max: 10_417, base: 0, over: 0, rate: 0 },
  { min: 10_417, max: 16_666.99, base: 0, over: 10_417, rate: 0.15 },
  { min: 16_667, max: 33_332.99, base: 1_250, over: 16_667, rate: 0.2 },
  { min: 33_333, max: 83_332.99, base: 5_000, over: 33_333, rate: 0.25 },
  { min: 83_333, max: 333_332.99, base: 20_416.67, over: 83_333, rate: 0.3 },
  {
    min: 333_333,
    max: 99_999_999.99,
    base: 100_416.67,
    over: 333_333,
    rate: 0.35,
  },
];

function buildBirBrackets() {
  const rows: {
    effectiveDate: Date;
    taxStatus: (typeof TAX_STATUSES)[number];
    frequency: "monthly" | "semi_monthly";
    minTaxable: number;
    maxTaxable: number;
    baseTax: number;
    excessOver: number;
    rate: number;
  }[] = [];

  for (const taxStatus of TAX_STATUSES) {
    for (const b of BIR_MONTHLY) {
      rows.push({
        effectiveDate: EFFECTIVE,
        taxStatus,
        frequency: "monthly",
        minTaxable: b.min,
        maxTaxable: b.max,
        baseTax: b.base,
        excessOver: b.over,
        rate: b.rate,
      });
    }
    for (const b of BIR_SEMI_MONTHLY) {
      rows.push({
        effectiveDate: EFFECTIVE,
        taxStatus,
        frequency: "semi_monthly",
        minTaxable: b.min,
        maxTaxable: b.max,
        baseTax: b.base,
        excessOver: b.over,
        rate: b.rate,
      });
    }
  }
  return rows;
}

async function main() {
  console.log("Seeding statutory tables for effective date 2025-01-01…");

  // Idempotent: clear this effective batch, then re-insert.
  await prisma.$transaction([
    prisma.statutorySssBracket.deleteMany({ where: { effectiveDate: EFFECTIVE } }),
    prisma.statutoryPhilhealthBracket.deleteMany({ where: { effectiveDate: EFFECTIVE } }),
    prisma.statutoryPagibigRate.deleteMany({ where: { effectiveDate: EFFECTIVE } }),
    prisma.statutoryBirBracket.deleteMany({ where: { effectiveDate: EFFECTIVE } }),
  ]);

  const sss = buildSssBrackets();
  const bir = buildBirBrackets();

  await prisma.statutorySssBracket.createMany({ data: sss });
  await prisma.statutoryPhilhealthBracket.create({ data: PHILHEALTH_ROW });
  await prisma.statutoryPagibigRate.createMany({ data: PAGIBIG_ROWS });
  await prisma.statutoryBirBracket.createMany({ data: bir });

  console.log(
    `Seeded: ${sss.length} SSS brackets, 1 PhilHealth row, ${PAGIBIG_ROWS.length} Pag-IBIG rows, ${bir.length} BIR brackets.`,
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
