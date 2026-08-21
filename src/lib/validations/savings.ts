import { z } from "zod";

// Kept free of any server-only Prisma import so these schemas stay usable on the
// client. Mirrors the conventions in `payroll.ts` / `schedule.ts`.

/** Admin sets/updates an employee's recurring savings contribution. */
export const upsertSavingsAccountSchema = z.object({
  employeeId: z.string().min(1, "Select an employee."),
  contributionAmount: z.coerce
    .number()
    .min(0, "Contribution can't be negative.")
    .max(1_000_000, "Amount is too large."),
  active: z.coerce.boolean().default(true),
});

/** Admin records a manual withdrawal or balance adjustment against an account. */
export const savingsAdjustmentSchema = z.object({
  employeeId: z.string().min(1, "Select an employee."),
  type: z.enum(["withdrawal", "adjustment"]),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than zero.")
    .max(1_000_000, "Amount is too large."),
  note: z.string().trim().max(200, "Keep the note short.").optional().nullable(),
});

export type UpsertSavingsAccountSchema = z.infer<
  typeof upsertSavingsAccountSchema
>;
export type SavingsAdjustmentSchema = z.infer<typeof savingsAdjustmentSchema>;
