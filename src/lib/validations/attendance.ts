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

export type UploadAttendanceSchema = z.infer<typeof uploadAttendanceSchema>;
export type MapDeviceSchema = z.infer<typeof mapDeviceSchema>;
