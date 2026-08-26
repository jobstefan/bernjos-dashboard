import { z } from "zod";

/**
 * Server-side environment variable validation.
 *
 * Import `env` from this module to get typed, validated access to the
 * environment instead of reaching for `process.env` directly. Parsing happens
 * once at import time and throws if a required variable is missing.
 */
const envSchema = z.object({
  // Database (Prisma + PostgreSQL)
  DATABASE_URL: z.string().min(1),

  // Clerk (optional when DEV_AUTH=true)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),

  // Inngest (optional locally — required in production)
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // RBAC dev bypass. Unset → on outside production (everyone = super_admin).
  // "false" enforces real Clerk roles even in dev; "true" forces the bypass on.
  PAYROLL_RBAC_BYPASS: z.enum(["true", "false"]).optional(),

  // Bootstrap admin accounts on first login. Comma-separated email addresses.
  // After first login, the DB role is authoritative and these vars are ignored.
  ADMIN_EMAILS: z.string().optional(),
  SUPERADMIN_EMAILS: z.string().optional(),

  // Password used by the Clerk user seed (`pnpm db:seed:users`). Dev-only.
  SEED_USER_PASSWORD: z.string().optional(),

  // Local dev login: when "true", bypass Clerk and use a simple cookie-based
  // role login (see src/lib/auth/dev-session.ts). Never enable in production.
  DEV_AUTH: z.enum(["true", "false"]).optional(),
  DEV_AUTH_PASSWORD: z.string().optional(),

  // Temporary password set on the Clerk account created for a new employee.
  // Handed out by the admin; the employee replaces it during first-login
  // onboarding. Defaults to "1234" (created with skipPasswordChecks).
  EMPLOYEE_TEMP_PASSWORD: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
