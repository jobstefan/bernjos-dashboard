import "server-only";
import {
  findDepartmentById,
  findDepartmentsWithPositions,
  insertDepartment,
  softDeleteDepartment,
  softDeletePositionsForDepartment,
  updateDepartmentRow,
} from "@/server/db/departments";
import { auditLog } from "@/server/services/audit.service";
import { NotFoundError } from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type {
  Department,
  DepartmentOption,
  DepartmentWithPositions,
} from "@/lib/types/organization";
import type {
  CreateDepartmentSchema,
  UpdateDepartmentSchema,
} from "@/lib/validations/organization";

type DepartmentWithPositionRows = Department & {
  positions: {
    id: string;
    name: string;
    departmentId: string;
    createdAt: Date;
  }[];
};

function toRow(dept: DepartmentWithPositionRows): DepartmentWithPositions {
  return {
    id: dept.id,
    name: dept.name,
    createdAt: dept.createdAt.toISOString(),
    positionCount: dept.positions.length,
    positions: dept.positions.map((p) => ({
      id: p.id,
      name: p.name,
      departmentId: p.departmentId,
      createdAt: p.createdAt.toISOString(),
    })),
  };
}

export async function getDepartments(): Promise<DepartmentWithPositions[]> {
  const departments = await findDepartmentsWithPositions();
  return departments.map(toRow);
}

/** Trimmed departments-with-positions shape for the employee form dropdowns. */
export async function getDepartmentOptions(): Promise<DepartmentOption[]> {
  const departments = await findDepartmentsWithPositions();
  return departments.map((d) => ({
    id: d.id,
    name: d.name,
    positions: d.positions.map((p) => ({ id: p.id, name: p.name })),
  }));
}

export async function createDepartment(
  input: CreateDepartmentSchema,
  actor: Actor,
): Promise<Department> {
  const department = await insertDepartment({ name: input.name });
  await auditLog({
    actor,
    action: "department.created",
    entityType: "department",
    entityId: department.id,
    after: department,
  });
  return department;
}

export async function updateDepartment(
  id: string,
  input: Omit<UpdateDepartmentSchema, "id">,
  actor: Actor,
): Promise<Department> {
  const before = await findDepartmentById(id);
  if (!before) throw new NotFoundError("Department", id);

  const after = await updateDepartmentRow(id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
  });
  await auditLog({
    actor,
    action: "department.updated",
    entityType: "department",
    entityId: id,
    before,
    after,
  });
  return after;
}

export async function deleteDepartment(
  id: string,
  actor: Actor,
): Promise<void> {
  const before = await findDepartmentById(id);
  if (!before) throw new NotFoundError("Department", id);
  // Remove the department's positions too so none are left orphaned.
  await softDeletePositionsForDepartment(id);
  const after = await softDeleteDepartment(id);
  await auditLog({
    actor,
    action: "department.deleted",
    entityType: "department",
    entityId: id,
    before,
    after,
  });
}
