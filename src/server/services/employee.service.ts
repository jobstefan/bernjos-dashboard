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
  createEmployeeClerkUser,
  deleteClerkUser,
  resetEmployeePassword as resetClerkPassword,
} from "@/server/services/clerk-account.service";
import { buildUsername, uniqueUsername } from "@/lib/auth/username";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { BadRequestError, NotFoundError } from "@/lib/errors/payroll";
import type { Actor, Employee, EmployeeFilters } from "@/lib/types/payroll";
import type {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
} from "@/lib/validations/payroll";
import type { Prisma } from "@/generated/prisma/client";

export function getEmployees(filters?: EmployeeFilters): Promise<Employee[]> {
  return findEmployees(filters);
}

export function getDepartments(): Promise<string[]> {
  return findDepartments();
}

export async function getEmployee(id: string): Promise<Employee> {
  const employee = await findEmployeeById(id);
  if (!employee) throw new NotFoundError("Employee", id);
  return employee;
}

/** Resolve the employee record linked to a Clerk user (self-service payslips). */
export function getEmployeeByClerkUser(
  clerkUserId: string,
): Promise<Employee | null> {
  return findEmployeeByClerkId(clerkUserId);
}

/** Map validated input to a Prisma create payload (nulls for empty optionals). */
function toCreateData(input: CreateEmployeeSchema): Prisma.EmployeeCreateInput {
  return {
    employeeCode: input.employeeCode,
    firstName: input.firstName,
    lastName: input.lastName,
    middleName: input.middleName ?? null,
    email: input.email ?? null,
    position: input.position,
    department: input.department,
    employmentStatus: input.employmentStatus,
    dateHired: input.dateHired,
    basicSalary: input.basicSalary,
    payFrequency: input.payFrequency,
    clerkUserId: input.clerkUserId ?? null,
    sssNumber: input.sssNumber ?? null,
    philhealthNumber: input.philhealthNumber ?? null,
    sssSalaryBasis: input.sssSalaryBasis ?? null,
    philhealthAmount: input.philhealthAmount ?? null,
    bankName: input.bankName ?? null,
    bankAccountNumber: input.bankAccountNumber ?? null,
  };
}

export async function createEmployee(
  input: CreateEmployeeSchema,
  actor: Actor,
): Promise<{ employee: Employee; username: string }> {
  const username = await uniqueUsername(
    buildUsername(input.firstName, input.lastName),
    input.employeeCode,
  );

  // In real Clerk mode, provision the login account first so we can link its id.
  // Dev-cookie mode has no Clerk; the employee simply gets no login account.
  const clerkUserId = isDevAuthEnabled()
    ? null
    : await createEmployeeClerkUser({
        username,
        firstName: input.firstName,
        lastName: input.lastName,
      });

  let employee: Employee;
  try {
    employee = await insertEmployee({
      ...toCreateData(input),
      username,
      clerkUserId,
    });
  } catch (error) {
    // Roll back the orphaned Clerk account if linking the DB row failed.
    if (clerkUserId) await deleteClerkUser(clerkUserId);
    throw error;
  }

  // Savings is mandatory: every employee starts with an account at the ₱100 floor.
  await upsertSavingsAccount({
    employeeId: employee.id,
    contributionAmount: 100,
    createdBy: actor.clerkUserId,
  });
  await auditLog({
    actor,
    action: "employee.created",
    entityType: "employee",
    entityId: employee.id,
    after: employee,
  });
  return { employee, username };
}

export async function updateEmployee(
  id: string,
  input: Omit<UpdateEmployeeSchema, "id">,
  actor: Actor,
): Promise<Employee> {
  const before = await findEmployeeById(id);
  if (!before) throw new NotFoundError("Employee", id);

  // Only assign provided fields; empty optionals become null.
  const data: Prisma.EmployeeUpdateInput = {};
  const assign = <K extends keyof Prisma.EmployeeUpdateInput>(
    key: K,
    value: Prisma.EmployeeUpdateInput[K] | undefined,
  ) => {
    if (value !== undefined) data[key] = value;
  };
  assign("employeeCode", input.employeeCode);
  assign("firstName", input.firstName);
  assign("lastName", input.lastName);
  assign("middleName", input.middleName ?? null);
  assign("email", input.email);
  assign("position", input.position);
  assign("department", input.department);
  assign("employmentStatus", input.employmentStatus);
  assign("dateHired", input.dateHired);
  assign("basicSalary", input.basicSalary);
  assign("payFrequency", input.payFrequency);
  assign("clerkUserId", input.clerkUserId ?? null);
  assign("sssNumber", input.sssNumber ?? null);
  assign("philhealthNumber", input.philhealthNumber ?? null);
  assign("sssSalaryBasis", input.sssSalaryBasis ?? null);
  assign("philhealthAmount", input.philhealthAmount ?? null);
  assign("bankName", input.bankName ?? null);
  assign("bankAccountNumber", input.bankAccountNumber ?? null);

  const employee = await updateEmployeeRow(id, data);
  await auditLog({
    actor,
    action: "employee.updated",
    entityType: "employee",
    entityId: id,
    before,
    after: employee,
  });
  return employee;
}

/**
 * Reset an employee's login to the temporary password and re-arm onboarding.
 * Used when an employee (typically one with no email for self-service recovery)
 * forgets their password: the admin resets it and hands the temp password out.
 */
export async function resetEmployeeLogin(id: string, actor: Actor): Promise<void> {
  const employee = await findEmployeeById(id);
  if (!employee) throw new NotFoundError("Employee", id);
  if (!employee.clerkUserId) {
    throw new BadRequestError("This employee has no login account to reset.");
  }
  await resetClerkPassword(employee.clerkUserId);
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
  await auditLog({
    actor,
    action: "employee.deactivated",
    entityType: "employee",
    entityId: id,
    before,
    after,
  });
}
