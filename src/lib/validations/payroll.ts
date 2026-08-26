import { z } from "zod";

// Enum values mirror the Prisma enums. Kept as literal tuples so these schemas
// stay usable on the client (no server-only Prisma import).
export const employmentStatusEnum = z.enum([
  "active",
  "inactive",
  "resigned",
  "terminated",
]);

export const payFrequencyEnum = z.enum(["semi_monthly", "monthly"]);

export const payrollStatusEnum = z.enum([
  "draft",
  "calculated",
  "pending_approval",
  "approved",
  "paid",
]);

// Accept `YYYY-MM-DD` strings (from <input type="date">) and coerce to Date.
const dateField = z.coerce.date({ message: "Enter a valid date." });

export const createEmployeeSchema = z.object({
  employeeCode: z.string().trim().min(1, "Employee code is required."),
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  middleName: z.string().trim().optional().nullable(),
  // Optional — many employees have no email. Admins enter it here when known.
  email: z.string().trim().email("Enter a valid email.").optional().nullable(),
  position: z.string().trim().min(1, "Position is required."),
  department: z.string().trim().min(1, "Department is required."),
  employmentStatus: employmentStatusEnum.default("active"),
  dateHired: dateField,
  basicSalary: z.coerce
    .number()
    .positive("Basic salary must be greater than zero."),
  payFrequency: payFrequencyEnum.default("semi_monthly"),
  sssNumber: z.string().trim().optional().nullable(),
  philhealthNumber: z.string().trim().optional().nullable(),
  sssSalaryBasis: z.coerce
    .number()
    .nonnegative("SSS contribution salary can't be negative.")
    .optional()
    .nullable(),
  philhealthAmount: z.coerce
    .number()
    .nonnegative("PhilHealth amount can't be negative.")
    .optional()
    .nullable(),
  contactNumber: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  bankName: z.string().trim().optional().nullable(),
  bankAccountNumber: z.string().trim().optional().nullable(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  id: z.string().min(1),
});

export const createPeriodSchema = z
  .object({
    periodLabel: z.string().trim().min(1, "Period label is required."),
    periodStart: dateField,
    periodEnd: dateField,
    payDate: dateField,
    frequency: payFrequencyEnum,
    notes: z.string().trim().optional().nullable(),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: "Period end must be on or after the start date.",
    path: ["periodEnd"],
  });

export const updatePayslipRemarksSchema = z.object({
  runItemId: z.string().min(1),
  remarks: z
    .string()
    .trim()
    .max(1000, "Remark is too long.")
    .optional()
    .nullable(),
});

export const periodFiltersSchema = z.object({
  status: payrollStatusEnum.optional(),
});

export const cashAdvanceStatusEnum = z.enum([
  "pending",
  "approved",
  "declined",
  "applied",
  "cancelled",
]);

export const createCashAdvanceSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Amount must be greater than zero.")
    .max(1_000_000, "Amount is too large."),
  reason: z.string().trim().min(1, "Please provide a reason for the request."),
});

export const approveCashAdvanceSchema = z.object({
  id: z.string().min(1),
  approvedAmount: z.coerce
    .number()
    .positive("Approved amount must be greater than zero.")
    .max(1_000_000, "Amount is too large."),
  note: z.string().trim().optional().nullable(),
});

export const declineCashAdvanceSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(1, "A reason for declining is required."),
});

export const employeeFiltersSchema = z.object({
  search: z.string().trim().optional(),
  department: z.string().trim().optional(),
  employmentStatus: employmentStatusEnum.optional(),
});

export type CreateEmployeeSchema = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeSchema = z.infer<typeof updateEmployeeSchema>;
export type CreatePeriodSchema = z.infer<typeof createPeriodSchema>;
export type UpdatePayslipRemarksSchema = z.infer<typeof updatePayslipRemarksSchema>;
export type CreateCashAdvanceSchema = z.infer<typeof createCashAdvanceSchema>;
export type ApproveCashAdvanceSchema = z.infer<typeof approveCashAdvanceSchema>;
export type DeclineCashAdvanceSchema = z.infer<typeof declineCashAdvanceSchema>;
