/**
 * Government contribution rate-change helper.
 *
 * SSS and PhilHealth rates are managed as Prisma migrations, not seed scripts,
 * so they deploy automatically through the normal staging → prod pipeline.
 *
 * HOW TO UPDATE RATES
 * ───────────────────
 * 1. Create a new migration file:
 *      pnpm prisma migrate dev --create-only --name gov_contributions_YYYY
 *
 * 2. Run this script locally to preview the INSERT rows for the new effective
 *    date, then paste the output into the generated migration.sql file:
 *      EFFECTIVE_DATE=2026-01-01 tsx prisma/seed-gov-contributions.ts
 *
 * 3. Review, commit, and push. The migration runs automatically on deploy.
 *
 * NOTE: Never edit a past migration. Each rate change is a new batch of rows
 * with a new effectiveDate so historical payroll runs stay reproducible.
 */

import "dotenv/config";

const EFFECTIVE = process.env.EFFECTIVE_DATE ?? "2025-01-01";

function buildSssBrackets() {
  const rows: { minSalary: number; maxSalary: number; monthlyCredit: number }[] = [];
  for (let msc = 5000; msc <= 35000; msc += 500) {
    const isFirst = msc === 5000;
    const isLast = msc === 35000;
    rows.push({
      minSalary: isFirst ? 0 : msc - 250,
      maxSalary: isLast ? 99_999_999.99 : msc + 250 - 0.01,
      monthlyCredit: msc,
    });
  }
  return rows;
}

function main() {
  const sss = buildSssBrackets();

  console.log(`-- SSS brackets effective ${EFFECTIVE}`);
  console.log(
    `INSERT INTO statutory_sss_brackets\n` +
    `  (id, effective_date, min_salary, max_salary, monthly_credit, employee_share, employer_share, created_at)\nVALUES`,
  );
  const sssLines = sss.map(
    (r, i) =>
      `  (gen_random_uuid(), '${EFFECTIVE}', ${String(r.minSalary).padStart(8)}, ${String(r.maxSalary).padStart(12)},` +
      `  ${String(r.monthlyCredit).padStart(5)},  0.05, 0.10, NOW())${i < sss.length - 1 ? "," : ";"}`,
  );
  console.log(sssLines.join("\n"));

  console.log(`\n-- PhilHealth bracket effective ${EFFECTIVE}`);
  console.log(
    `INSERT INTO statutory_philhealth_brackets\n` +
    `  (id, effective_date, min_salary, max_salary, rate, min_contribution, max_contribution, created_at)\nVALUES\n` +
    `  (gen_random_uuid(), '${EFFECTIVE}', 10000, 100000, 0.05, 500, 5000, NOW());`,
  );

  console.log(`\n-- ${sss.length} SSS brackets + 1 PhilHealth row`);
}

main();
