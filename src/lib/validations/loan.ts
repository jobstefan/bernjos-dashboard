import { z } from "zod";

const TERM_OPTIONS = [1, 2, 3, 4] as const;

/** Employee requests a loan. */
export const createLoanSchema = z.object({
  branchId: z.string().min(1, "Select a branch."),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than zero.")
    .max(10_000_000, "Amount is too large."),
  termPeriods: z.coerce
    .number()
    .refine((v) => (TERM_OPTIONS as readonly number[]).includes(v), {
      message: "Choose 1, 2, 3, or 4 pay periods.",
    }),
  reason: z
    .string()
    .trim()
    .min(5, "Please provide a reason (at least 5 characters).")
    .max(500, "Reason must not exceed 500 characters."),
});

/** Admin creates a loan on behalf of an employee (instant active). */
export const adminCreateLoanSchema = z.object({
  profileId: z.string().min(1, "Select an employee."),
  branchId: z.string().min(1, "Select a branch."),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than zero.")
    .max(10_000_000, "Amount is too large."),
  termPeriods: z.coerce
    .number()
    .refine((v) => (TERM_OPTIONS as readonly number[]).includes(v), {
      message: "Choose 1, 2, 3, or 4 pay periods.",
    }),
  reason: z
    .string()
    .trim()
    .min(5, "Please provide a reason (at least 5 characters).")
    .max(500, "Reason must not exceed 500 characters."),
});

export const approveLoanSchema = z.object({
  id: z.string().min(1),
  branchId: z.string().min(1, "Select a branch."),
  note: z.string().trim().max(500).optional().nullable(),
});

export const declineLoanSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(1, "Please provide a reason.").max(500),
});

export const disburseLoanSchema = z.object({
  id: z.string().min(1),
});

export const cancelLoanSchema = z.object({
  id: z.string().min(1),
});

export const pauseLoanSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().max(500).optional().nullable(),
});

export const resumeLoanSchema = z.object({
  id: z.string().min(1),
});

export type CreateLoanSchema = z.infer<typeof createLoanSchema>;
export type AdminCreateLoanSchema = z.infer<typeof adminCreateLoanSchema>;
export type ApproveLoanSchema = z.infer<typeof approveLoanSchema>;
export type DeclineLoanSchema = z.infer<typeof declineLoanSchema>;
export type PauseLoanSchema = z.infer<typeof pauseLoanSchema>;
export type ResumeLoanSchema = z.infer<typeof resumeLoanSchema>;
