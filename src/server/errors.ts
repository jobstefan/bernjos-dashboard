import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { PayrollError } from "@/lib/errors/payroll";

/** Shape returned to the client so it can show a message + highlight fields. */
export interface ActionError {
  error: string;
  fieldErrors?: Record<string, string[]>;
}

// Unique-constraint targets we can translate into a friendly, field-scoped message.
// Matched against P2002 `meta.target` (column names *or* the constraint/index name).
const UNIQUE_FIELDS: {
  token: string;
  field: string;
  label: string;
}[] = [
  { token: "employee_code", field: "employeeCode", label: "employee code" },
  { token: "clerk_user_id", field: "clerkUserId", label: "Clerk user ID" },
  { token: "email", field: "email", label: "email address" },
];

function uniqueTargetTokens(target: unknown): string[] {
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === "string") return [target];
  return [];
}

/**
 * Translate any thrown value into a user-facing message (and, where possible,
 * field-level errors). Domain errors keep their message; database errors are
 * mapped to plain language; anything else is generalized so we never leak
 * internals in production.
 */
export function toActionError(error: unknown): ActionError {
  // Our own typed domain errors already carry a user-appropriate message.
  if (error instanceof PayrollError) {
    return { error: error.message };
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": {
        const tokens = uniqueTargetTokens(error.meta?.target);
        const fieldErrors: Record<string, string[]> = {};
        for (const { token, field, label } of UNIQUE_FIELDS) {
          if (tokens.some((t) => t.includes(token))) {
            fieldErrors[field] = [`This ${label} is already in use.`];
          }
        }
        return {
          error: "Some values must be unique. Please review the highlighted fields.",
          fieldErrors:
            Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
        };
      }
      case "P2025":
        return {
          error: "That record no longer exists — it may have been deleted.",
        };
      case "P2003":
        return {
          error: "This references a record that doesn't exist. Refresh and try again.",
        };
      default:
        return {
          error: "The database rejected this request. Please check your input and try again.",
        };
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      error: "Can't reach the database right now. Please try again in a moment.",
    };
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return { error: "Some values were invalid. Please review the form and try again." };
  }

  // Unknown/unexpected: don't leak internals in production.
  if (error instanceof Error) {
    return {
      error:
        process.env.NODE_ENV === "production"
          ? "Something went wrong. Please try again."
          : error.message,
    };
  }

  return { error: "An unexpected error occurred." };
}
