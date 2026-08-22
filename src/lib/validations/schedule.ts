import { z } from "zod";

// `HH:MM` 24-hour time from <input type="time">.
const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time.");

/** One working employee's entry for a day (only sent for employees who work). */
export const scheduleEntryInputSchema = z
  .object({
    employeeId: z.string().min(1),
    branchId: z.string().trim().optional().nullable(),
    startTime: hhmm,
    endTime: hhmm,
    note: z.string().trim().max(200, "Keep the note short.").optional().nullable(),
  })
  .refine((v) => v.endTime >= v.startTime, {
    message: "End time must be on or after the start time.",
    path: ["endTime"],
  });

/** Save a full day's schedule: the date plus every working employee's entry. */
export const saveDayScheduleSchema = z.object({
  date: z.coerce.date({ message: "Enter a valid date." }),
  entries: z.array(scheduleEntryInputSchema),
});

export const createBranchSchema = z.object({
  name: z.string().trim().min(1, "Branch name is required."),
  address: z.string().trim().max(200).optional().nullable(),
  /** Biometric adapter key (see src/lib/attendance/adapters). Empty = none. */
  attendanceFormat: z.string().trim().optional().nullable(),
});

export const updateBranchSchema = createBranchSchema.partial().extend({
  id: z.string().min(1),
});

export type ScheduleEntryInput = z.infer<typeof scheduleEntryInputSchema>;
export type SaveDayScheduleSchema = z.infer<typeof saveDayScheduleSchema>;
export type CreateBranchSchema = z.infer<typeof createBranchSchema>;
export type UpdateBranchSchema = z.infer<typeof updateBranchSchema>;
