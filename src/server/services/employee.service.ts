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
import { auditLog } from "@/server/services/audit.service";
import { NotFoundError } from "@/lib/errors/payroll";
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
    email: input.email,
    position: input.position,
    department: input.department,
    employmentStatus: input.employmentStatus,
    dateHired: input.dateHired,
    basicSalary: input.basicSalary,
    payFrequency: input.payFrequency,
    clerkUserId: input.clerkUserId ?? null,
    sssNumber: input.sssNumber ?? null,
    philhealthNumber: input.philhealthNumber ?? null,
    bankName: input.bankName ?? null,
    bankAccountNumber: input.bankAccountNumber ?? null,
  };
}

export async function createEmployee(
  input: CreateEmployeeSchema,
  actor: Actor,
): Promise<Employee> {
  const employee = await insertEmployee(toCreateData(input));
  await auditLog({
    actor,
    action: "employee.created",
    entityType: "employee",
    entityId: employee.id,
    after: employee,
  });
  return employee;
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
