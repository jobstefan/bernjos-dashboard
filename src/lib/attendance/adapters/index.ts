import { BadRequestError } from "@/lib/errors/payroll";
import { deli } from "./deli";
import type { AttendanceAdapter } from "./types";
import { zkteco } from "./zkteco";

export type { AttendanceAdapter, DailyRecord, SheetGrid } from "./types";

/**
 * Registry of biometric formats. Adding a new scanner = add its adapter here.
 * Keys are stored on `Branch.attendanceFormat` and `AttendanceImport.format`.
 */
const registry: Record<string, AttendanceAdapter> = {
  [deli.format]: deli,
  [zkteco.format]: zkteco,
};

/** Every registered format, for populating the branch config dropdown. */
export function listFormats(): { format: string; label: string }[] {
  return Object.values(registry).map((a) => ({
    format: a.format,
    label: a.label,
  }));
}

/** Resolve an adapter by format key, or throw if the format is unknown. */
export function getAdapter(format: string): AttendanceAdapter {
  const adapter = registry[format];
  if (!adapter) {
    throw new BadRequestError(`Unknown attendance format: "${format}".`);
  }
  return adapter;
}
