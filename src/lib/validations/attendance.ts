import { z } from "zod";

/** Upload a branch's biometric Excel export. File bytes arrive base64-encoded. */
export const uploadAttendanceSchema = z.object({
  branchId: z.string().min(1, "Choose a branch."),
  fileName: z.string().trim().min(1),
  /** The workbook, base64-encoded (read client-side from the file input). */
  fileBase64: z.string().min(1, "Choose a file to upload."),
});

/** Map a scanner enrollment id to an employee, scoped to a branch. */
export const mapDeviceSchema = z.object({
  employeeId: z.string().min(1, "Choose an employee."),
  branchId: z.string().min(1),
  deviceUserId: z.string().trim().min(1, "Enter the device id."),
});

// `HH:MM` 24-hour time from <input type="time">; empty string → null (cleared).
const hhmmOrNull = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time.")
  .or(z.literal(""))
  .nullish()
  .transform((v) => (v ? v : null));

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Admin manual edit of one employee-day's attendance. */
export const editAttendanceSchema = z.object({
  employeeId: z.string().min(1, "Choose an employee."),
  date: z.string().regex(DATE_RE, "Enter a valid date."),
  timeIn: hhmmOrNull,
  timeOut: hhmmOrNull,
  /** Start of the mid-day gap (first punch-out during the shift). */
  gapStart: hhmmOrNull,
  /** End of the mid-day gap (first punch-back-in during the shift). */
  gapEnd: hhmmOrNull,
  /** Second mid-day gap start — optional manual add-in. */
  gap2Start: hhmmOrNull,
  /** Second mid-day gap end — optional manual add-in. */
  gap2End: hhmmOrNull,
});

/** Remove one employee-day's attendance record. */
export const deleteAttendanceSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().regex(DATE_RE, "Enter a valid date."),
});

export type UploadAttendanceSchema = z.infer<typeof uploadAttendanceSchema>;
export type MapDeviceSchema = z.infer<typeof mapDeviceSchema>;
export type EditAttendanceSchema = z.infer<typeof editAttendanceSchema>;
export type DeleteAttendanceSchema = z.infer<typeof deleteAttendanceSchema>;
