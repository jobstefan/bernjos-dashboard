import "server-only";
import { findEmployeeByUsername } from "@/server/db/employees";

/** Clerk's default minimum username length. Below this, Clerk rejects the user. */
const MIN_USERNAME_LENGTH = 4;

/**
 * Transliterate accented/special characters common in Filipino names to their
 * ASCII base, then keep only lowercase letters and digits.
 * e.g. "Ñ" → "n", "é" → "e", so "Niño" → "nino" not "nio".
 */
function sanitize(value: string): string {
  return value
    .normalize("NFD")           // decompose accents: "ñ" → "n" + combining tilde
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/ñ/gi, "n")        // ñ doesn't decompose via NFD — handle explicitly
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Build the base login username from a name: initials of every first-name token
 * followed by the full last name, lowercased and stripped of punctuation/spaces.
 *
 *   "Juan Miguel" + "Dela Cruz" -> "jmdelacruz"
 */
export function buildUsername(firstName: string, lastName: string): string {
  const initials = firstName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token[0])
    .join("");
  return sanitize(initials + lastName);
}

/**
 * Resolve a globally-unique username. Starts from `base`; if that name is too
 * short it falls back to the (sanitized) employee code, then appends an
 * incrementing suffix until the DB has no matching row.
 */
export async function uniqueUsername(
  base: string,
  employeeCode: string,
): Promise<string> {
  let candidate = base;
  if (candidate.length < MIN_USERNAME_LENGTH) {
    const fallback = sanitize(employeeCode);
    // Pad short fallbacks so we never fall below Clerk's minimum.
    candidate = fallback.length >= MIN_USERNAME_LENGTH
      ? fallback
      : (candidate + fallback).padEnd(MIN_USERNAME_LENGTH, "0");
  }

  const root = candidate;
  for (let suffix = 0; ; suffix++) {
    const name = suffix === 0 ? root : `${root}${suffix + 1}`;
    const existing = await findEmployeeByUsername(name);
    if (!existing) return name;
  }
}
