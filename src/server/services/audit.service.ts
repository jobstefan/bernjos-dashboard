import "server-only";
import { insertAuditLog } from "@/server/db/audit";
import type { Actor } from "@/lib/types/payroll";
import type { Prisma } from "@/generated/prisma/client";

interface AuditParams {
  actor: Actor;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

/** JSON-serialize a snapshot (handles Date / Prisma.Decimal via JSON coercion). */
function snapshot(value: unknown): Prisma.InputJsonValue | null {
  if (value === undefined || value === null) return null;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/**
 * Record an audit-trail entry. Called by every mutating service function with the
 * before/after state so changes are fully reconstructable.
 */
export async function auditLog(params: AuditParams): Promise<void> {
  await insertAuditLog({
    actorId: params.actor.clerkUserId,
    actorEmail: params.actor.email,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    before: snapshot(params.before),
    after: snapshot(params.after),
  });
}
