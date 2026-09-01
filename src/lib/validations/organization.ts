import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().trim().min(1, "Department name is required."),
  shiftHours: z.number().int().min(1, "Shift must be at least 1 hour.").max(24, "Shift cannot exceed 24 hours.").default(8),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().extend({
  id: z.string().min(1),
});

export const createPositionSchema = z.object({
  name: z.string().trim().min(1, "Position name is required."),
  departmentId: z.string().min(1, "Select a department."),
  shiftHours: z.number().int().min(1, "Shift must be at least 1 hour.").max(24, "Shift cannot exceed 24 hours.").default(8),
});

export const updatePositionSchema = createPositionSchema.partial().extend({
  id: z.string().min(1),
});

export type CreateDepartmentSchema = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentSchema = z.infer<typeof updateDepartmentSchema>;
export type CreatePositionSchema = z.infer<typeof createPositionSchema>;
export type UpdatePositionSchema = z.infer<typeof updatePositionSchema>;
