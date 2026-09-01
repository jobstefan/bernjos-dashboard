import { z } from "zod";

export const createIncentiveSchema = z.object({
  profileId: z.string().min(1, "Select an employee."),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than zero.")
    .max(1_000_000, "Amount exceeds the maximum allowed limit."),
  reason: z.string().trim().max(500, "Reason must not exceed 500 characters.").optional().nullable(),
});

export const cancelIncentiveSchema = z.object({
  id: z.string().min(1),
});

export type CreateIncentiveSchema = z.infer<typeof createIncentiveSchema>;
export type CancelIncentiveSchema = z.infer<typeof cancelIncentiveSchema>;
