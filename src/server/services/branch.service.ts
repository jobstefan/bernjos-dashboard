import "server-only";
import {
  findBranchById,
  findBranches,
  insertBranch,
  softDeleteBranch,
  updateBranchRow,
} from "@/server/db/branches";
import { auditLog } from "@/server/services/audit.service";
import { NotFoundError } from "@/lib/errors/payroll";
import type { Actor } from "@/lib/types/payroll";
import type { Branch, BranchRow } from "@/lib/types/schedule";
import type {
  CreateBranchSchema,
  UpdateBranchSchema,
} from "@/lib/validations/schedule";

function toRow(branch: Branch): BranchRow {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    createdAt: branch.createdAt.toISOString(),
  };
}

export async function getBranches(): Promise<BranchRow[]> {
  const branches = await findBranches();
  return branches.map(toRow);
}

export async function createBranch(
  input: CreateBranchSchema,
  actor: Actor,
): Promise<Branch> {
  const branch = await insertBranch({
    name: input.name,
    address: input.address ?? null,
  });
  await auditLog({
    actor,
    action: "branch.created",
    entityType: "branch",
    entityId: branch.id,
    after: branch,
  });
  return branch;
}

export async function updateBranch(
  id: string,
  input: Omit<UpdateBranchSchema, "id">,
  actor: Actor,
): Promise<Branch> {
  const before = await findBranchById(id);
  if (!before) throw new NotFoundError("Branch", id);

  const after = await updateBranchRow(id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.address !== undefined ? { address: input.address ?? null } : {}),
  });
  await auditLog({
    actor,
    action: "branch.updated",
    entityType: "branch",
    entityId: id,
    before,
    after,
  });
  return after;
}

export async function deleteBranch(id: string, actor: Actor): Promise<void> {
  const before = await findBranchById(id);
  if (!before) throw new NotFoundError("Branch", id);
  const after = await softDeleteBranch(id);
  await auditLog({
    actor,
    action: "branch.deleted",
    entityType: "branch",
    entityId: id,
    before,
    after,
  });
}
