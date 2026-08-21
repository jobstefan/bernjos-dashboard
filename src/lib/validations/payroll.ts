import { z } from "zod";

// Enum values mirror the Prisma enums. Kept as literal tuples so these schemas
// stay usable on the client (no server-only Prisma import).
export const employmentTypeEnum = z.enum([
  "regular",
  "probationary",
  "contractual",
  "part_time",
]);

export const employmentStatusEnum = z.enum([
  "active",
  "inactive",
  "resigned",
  "terminated",
]);

export const payFrequencyEnum = z.enum(["semi_monthly", "monthly"]);

export const taxStatusEnum = z.enum([
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
]);

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
  email: z.string().trim().email("Enter a valid email."),
  position: z.string().trim().min(1, "Position is required."),
  department: z.string().trim().min(1, "Department is required."),
  employmentType: employmentTypeEnum,
  employmentStatus: employmentStatusEnum.default("active"),
  dateHired: dateField,
  dateRegularized: dateField.optional().nullable(),
  basicSalary: z.coerce
    .number()
    .positive("Basic salary must be greater than zero."),
  payFrequency: payFrequencyEnum.default("semi_monthly"),
  taxStatus: taxStatusEnum,
  clerkUserId: z.string().trim().optional().nullable(),
  sssNumber: z.string().trim().optional().nullable(),
  philhealthNumber: z.string().trim().optional().nullable(),
  pagibigNumber: z.string().trim().optional().nullable(),
  tin: z.string().trim().optional().nullable(),
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

export const periodFiltersSchema = z.object({
  status: payrollStatusEnum.optional(),
});

export const employeeFiltersSchema = z.object({
  search: z.string().trim().optional(),
  department: z.string().trim().optional(),
  employmentStatus: employmentStatusEnum.optional(),
  employmentType: employmentTypeEnum.optional(),
});

export type CreateEmployeeSchema = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeSchema = z.infer<typeof updateEmployeeSchema>;
export type CreatePeriodSchema = z.infer<typeof createPeriodSchema>;
