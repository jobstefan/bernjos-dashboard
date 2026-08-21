import "server-only";
import { prisma } from "@/lib/db";
import type { PayFrequency, TaxStatus } from "@/lib/types/payroll";

/**
 * Statutory lookups. Each finds the row set with the latest `effectiveDate` on or
 * before the given date, then the bracket whose salary/taxable range contains the
 * value. Returns `null` when nothing applies (caller raises MissingStatutoryDataError).
 */

async function latestEffectiveDate(
  table:
    | "statutorySssBracket"
    | "statutoryPhilhealthBracket"
    | "statutoryPagibigRate"
    | "statutoryBirBracket",
  onOrBefore: Date,
): Promise<Date | null> {
  // @ts-expect-error indexing the delegate by name is safe for these four models
  const row = await prisma[table].findFirst({
    where: { effectiveDate: { lte: onOrBefore } },
    orderBy: { effectiveDate: "desc" },
    select: { effectiveDate: true },
  });
  return row?.effectiveDate ?? null;
}

export async function findSssBracket(salary: number, onOrBefore: Date) {
  const effectiveDate = await latestEffectiveDate("statutorySssBracket", onOrBefore);
  if (!effectiveDate) return null;
  return prisma.statutorySssBracket.findFirst({
    where: {
      effectiveDate,
      minSalary: { lte: salary },
      maxSalary: { gte: salary },
    },
    orderBy: { minSalary: "desc" },
  });
}

export async function findPhilhealthBracket(salary: number, onOrBefore: Date) {
  const effectiveDate = await latestEffectiveDate(
    "statutoryPhilhealthBracket",
    onOrBefore,
  );
  if (!effectiveDate) return null;
  // PhilHealth has one active row; the floor/ceiling are applied in the service.
  return prisma.statutoryPhilhealthBracket.findFirst({
    where: { effectiveDate },
    orderBy: { minSalary: "asc" },
  });
}

export async function findPagibigRate(salary: number, onOrBefore: Date) {
  const effectiveDate = await latestEffectiveDate(
    "statutoryPagibigRate",
    onOrBefore,
  );
  if (!effectiveDate) return null;
  return prisma.statutoryPagibigRate.findFirst({
    where: {
      effectiveDate,
      minSalary: { lte: salary },
      maxSalary: { gte: salary },
    },
    orderBy: { minSalary: "desc" },
  });
}

export async function findBirBracket(
  taxable: number,
  taxStatus: TaxStatus,
  frequency: PayFrequency,
  onOrBefore: Date,
) {
  const effectiveDate = await latestEffectiveDate("statutoryBirBracket", onOrBefore);
  if (!effectiveDate) return null;
  return prisma.statutoryBirBracket.findFirst({
    where: {
      effectiveDate,
      taxStatus,
      frequency,
      minTaxable: { lte: taxable },
      maxTaxable: { gte: taxable },
    },
    orderBy: { minTaxable: "desc" },
  });
}
