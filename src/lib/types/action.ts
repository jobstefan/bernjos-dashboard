/**
 * Standard result shape for Server Actions. Lives in a plain module (not a
 * `"use server"` file) so it can be imported as a type by both actions and
 * client components — `"use server"` modules may only export async functions.
 */
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };
