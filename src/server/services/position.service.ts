import "server-only";
import { findDepartmentById } from "@/server/db/departments";
import {
  findPositionById,
  insertPosition,
  softDeletePosition,
  updatePositionRow,
} from "@/server/db/positions";
import { auditLog } from "@/server/services/audit.service";
import { NotFoundError } from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type { Position } from "@/lib/types/organization";
import type {
  CreatePositionSchema,
  UpdatePositionSchema,
} from "@/lib/validations/organization";

export async function createPosition(
  input: CreatePositionSchema,
  actor: Actor,
): Promise<Position> {
  const department = await findDepartmentById(input.departmentId);
  if (!department) throw new NotFoundError("Department", input.departmentId);

  const position = await insertPosition({
    name: input.name,
    shiftHours: input.shiftHours,
    department: { connect: { id: input.departmentId } },
  });
  await auditLog({
    actor,
    action: "position.created",
    entityType: "position",
    entityId: position.id,
    after: position,
  });
  return position;
}

export async function updatePosition(
  id: string,
  input: Omit<UpdatePositionSchema, "id">,
  actor: Actor,
): Promise<Position> {
  const before = await findPositionById(id);
  if (!before) throw new NotFoundError("Position", id);

  if (input.departmentId !== undefined) {
    const department = await findDepartmentById(input.departmentId);
    if (!department) throw new NotFoundError("Department", input.departmentId);
  }

  const after = await updatePositionRow(id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.shiftHours !== undefined ? { shiftHours: input.shiftHours } : {}),
    ...(input.departmentId !== undefined
      ? { department: { connect: { id: input.departmentId } } }
      : {}),
  });
  await auditLog({
    actor,
    action: "position.updated",
    entityType: "position",
    entityId: id,
    before,
    after,
  });
  return after;
}

export async function deletePosition(id: string, actor: Actor): Promise<void> {
  const before = await findPositionById(id);
  if (!before) throw new NotFoundError("Position", id);
  const after = await softDeletePosition(id);
  await auditLog({
    actor,
    action: "position.deleted",
    entityType: "position",
    entityId: id,
    before,
    after,
  });
}
