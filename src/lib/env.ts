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

  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),

  // Inngest (optional locally — required in production)
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
