import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export interface AuditLogInput {
  actorId: string;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

/** Insert an audit-trail row. All payroll/employee mutations funnel through here. */
export function insertAuditLog(input: AuditLogInput) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: input.before ?? undefined,
      afterState: input.after ?? undefined,
      ipAddress: input.ipAddress ?? null,
    },
  });
}
