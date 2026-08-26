import "server-only";
import {
  findDepartments,
  findEmployeeByClerkId,
  findEmployeeById,
  findEmployees,
  insertEmployee,
  softDeleteEmployee,
  updateEmployeeRow,
} from "@/server/db/employees";
import { upsertSavingsAccount } from "@/server/db/savings";
import { auditLog } from "@/server/services/audit.service";
import {
  banClerkUser,
  createEmployeeClerkUser,
  deleteClerkUser,
  resetEmployeePassword as resetClerkPassword,
  unbanClerkUser,
} from "@/server/services/clerk-account.service";
import type { EmploymentStatus } from "@/generated/prisma/enums";
import { buildUsername, uniqueUsername } from "@/lib/auth/username";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { prisma } from "@/lib/db";
import { BadRequestError, NotFoundError } from "@/lib/errors/payroll";
import type { Actor, UserProfile, ProfileFilters } from "@/lib/types/payroll";
import type {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
} from "@/lib/validations/payroll";
import type { Prisma } from "@/generated/prisma/client";

const TERMINAL_STATUSES: EmploymentStatus[] = ["resigned", "terminated", "inactive"];

/** Resolve the Clerk user id for a profile (returns null if dev-auth or no account). */
async function clerkIdForProfile(profileId: string): Promise<string | null> {
  if (isDevAuthEnabled()) return null;
  const profile = await prisma.userProfile.findUnique({
    where: { id: profileId },
    select: { userId: true },
  });
  if (!profile?.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: profile.userId },
    select: { clerkId: true },
  });
  return user?.clerkId ?? null;
}

export function getEmployees(filters?: ProfileFilters) {
  return findEmployees(filters);
}

export function getDepartments(): Promise<string[]> {
  return findDepartments();
}

export async function getEmployee(id: string) {
  const profile = await findEmployeeById(id);
  if (!profile) throw new NotFoundError("Employee", id);
  return profile;
}

/** Resolve the profile linked to a Clerk user (self-service payslips). */
export function getEmployeeByClerkUser(
  clerkUserId: string,
): Promise<UserProfile | null> {
  return findEmployeeByClerkId(clerkUserId);
}

/** Map validated input to a Prisma UserProfile create payload. */
function toCreateData(input: CreateEmployeeSchema): Omit<Prisma.UserProfileCreateInput, "user"> {
  return {
    employeeCode: input.employeeCode,
    firstName: input.firstName,
    lastName: input.lastName,
    middleName: input.middleName ?? null,
    position: input.position,
    department: input.department,
    employmentStatus: input.employmentStatus,
    dateHired: input.dateHired,
    basicSalary: input.basicSalary,
    payFrequency: input.payFrequency,
    sssNumber: input.sssNumber ?? null,
    philhealthNumber: input.philhealthNumber ?? null,
    sssSalaryBasis: input.sssSalaryBasis ?? null,
    philhealthAmount: input.philhealthAmount ?? null,
    contactNumber: input.contactNumber ?? null,
    address: input.address ?? null,
    bankName: input.bankName ?? null,
    bankAccountNumber: input.bankAccountNumber ?? null,
  };
}

export async function createEmployee(
  input: CreateEmployeeSchema,
  actor: Actor,
): Promise<{ employee: UserProfile; username: string }> {
  const username = await uniqueUsername(
    buildUsername(input.firstName, input.lastName, input.middleName),
    input.employeeCode,
  );

  // In real Clerk mode, provision the login account first so we can link its id.
  // Dev-cookie mode has no Clerk; the profile simply gets no login account.
  const clerkUserId = isDevAuthEnabled()
    ? null
    : await createEmployeeClerkUser({
        username,
        firstName: input.firstName,
        lastName: input.lastName,
      });

  // Upsert a User identity row for the new Clerk account so the profile is
  // immediately linked and getOrCreateUser() picks it up on first login.
  let userId: string | undefined;
  if (clerkUserId) {
    const user = await prisma.user.upsert({
      where: { clerkId: clerkUserId },
      update: {},
      create: {
        clerkId: clerkUserId,
        email: input.email ?? null,
        firstName: input.firstName,
        lastName: input.lastName,
        role: "employee",
      },
      select: { id: true },
    });
    userId = user.id;
  }

  let profile: UserProfile;
  try {
    profile = await insertEmployee({
      ...toCreateData(input),
      username,
      ...(userId ? { user: { connect: { id: userId } } } : {}),
    });
  } catch (error) {
    // Roll back the orphaned Clerk account and User row if the profile insert failed.
    if (clerkUserId) await deleteClerkUser(clerkUserId);
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    throw error;
  }

  // Savings is mandatory: every profile starts with an account at the ₱100 floor.
  await upsertSavingsAccount({
    employeeId: profile.id,
    contributionAmount: 100,
    createdBy: actor.clerkUserId,
  });
  await auditLog({
    actor,
    action: "employee.created",
    entityType: "employee",
    entityId: profile.id,
    after: profile,
  });
  return { employee: profile, username };
}

export async function updateEmployee(
  id: string,
  input: Omit<UpdateEmployeeSchema, "id">,
  actor: Actor,
): Promise<UserProfile> {
  const before = await findEmployeeById(id);
  if (!before) throw new NotFoundError("Employee", id);

  // Only assign provided fields; empty optionals become null.
  const data: Prisma.UserProfileUpdateInput = {};
  const assign = <K extends keyof Prisma.UserProfileUpdateInput>(
    key: K,
    value: Prisma.UserProfileUpdateInput[K] | undefined,
  ) => {
    if (value !== undefined) data[key] = value;
  };
  assign("employeeCode", input.employeeCode);
  assign("firstName", input.firstName);
  assign("lastName", input.lastName);
  assign("middleName", input.middleName ?? null);
  assign("position", input.position);
  assign("department", input.department);
  assign("employmentStatus", input.employmentStatus);
  assign("dateHired", input.dateHired);
  assign("basicSalary", input.basicSalary);
  assign("payFrequency", input.payFrequency);
  assign("sssNumber", input.sssNumber ?? null);
  assign("philhealthNumber", input.philhealthNumber ?? null);
  assign("sssSalaryBasis", input.sssSalaryBasis ?? null);
  assign("philhealthAmount", input.philhealthAmount ?? null);
  assign("contactNumber", input.contactNumber ?? null);
  assign("address", input.address ?? null);
  assign("bankName", input.bankName ?? null);
  assign("bankAccountNumber", input.bankAccountNumber ?? null);

  // If email changed, update the linked User row (email lives on User, not profile).
  if (input.email !== undefined && before.userId) {
    await prisma.user.update({
      where: { id: before.userId },
      data: { email: input.email ?? null },
    }).catch(() => undefined);
  }

  const profile = await updateEmployeeRow(id, data);

  // Sync Clerk ban state when employment status crosses the active/terminal boundary.
  if (input.employmentStatus && input.employmentStatus !== before.employmentStatus) {
    const clerkId = await clerkIdForProfile(id);
    if (clerkId) {
      if (TERMINAL_STATUSES.includes(input.employmentStatus as EmploymentStatus)) {
        await banClerkUser(clerkId);
      } else if (input.employmentStatus === "active") {
        await unbanClerkUser(clerkId);
      }
    }
  }

  await auditLog({
    actor,
    action: "employee.updated",
    entityType: "employee",
    entityId: id,
    before,
    after: profile,
  });
  return profile;
}

/**
 * Reset a profile's login to the temporary password and re-arm onboarding.
 */
export async function resetEmployeeLogin(id: string, actor: Actor): Promise<void> {
  const profile = await findEmployeeById(id);
  if (!profile) throw new NotFoundError("Employee", id);
  if (!profile.userId) {
    throw new BadRequestError("This employee has no login account to reset.");
  }
  const user = await prisma.user.findUnique({
    where: { id: profile.userId },
    select: { clerkId: true },
  });
  if (!user?.clerkId) {
    throw new BadRequestError("This employee has no Clerk account to reset.");
  }
  await resetClerkPassword(user.clerkId);
  await auditLog({
    actor,
    action: "employee.password_reset",
    entityType: "employee",
    entityId: id,
  });
}

export async function deactivateEmployee(id: string, actor: Actor): Promise<void> {
  const before = await findEmployeeById(id);
  if (!before) throw new NotFoundError("Employee", id);
  const after = await softDeleteEmployee(id);

  const clerkId = await clerkIdForProfile(id);
  if (clerkId) await banClerkUser(clerkId);

  await auditLog({
    actor,
    action: "employee.deactivated",
    entityType: "employee",
    entityId: id,
    before,
    after,
  });
}
