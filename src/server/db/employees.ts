import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { EmployeeFilters } from "@/lib/types/payroll";

/** Build a Prisma where-clause from employee filters (always excludes soft-deleted). */
function buildWhere(filters?: EmployeeFilters): Prisma.EmployeeWhereInput {
  const where: Prisma.EmployeeWhereInput = { deletedAt: null };
  if (filters?.department) where.department = filters.department;
  if (filters?.employmentStatus) where.employmentStatus = filters.employmentStatus;
  if (filters?.search) {
    const search = filters.search;
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { employeeCode: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { position: { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
}

export function findEmployees(filters?: EmployeeFilters) {
  return prisma.employee.findMany({
    where: buildWhere(filters),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export function findEmployeeById(id: string) {
  return prisma.employee.findFirst({ where: { id, deletedAt: null } });
}

export function findEmployeeByClerkId(clerkUserId: string) {
  return prisma.employee.findFirst({ where: { clerkUserId, deletedAt: null } });
}

export function findActiveEmployeesByFrequency(
  frequency: "semi_monthly" | "monthly",
) {
  return prisma.employee.findMany({
    where: {
      deletedAt: null,
      employmentStatus: "active",
      payFrequency: frequency,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export function insertEmployee(data: Prisma.EmployeeCreateInput) {
  return prisma.employee.create({ data });
}

export function updateEmployeeRow(id: string, data: Prisma.EmployeeUpdateInput) {
  return prisma.employee.update({ where: { id }, data });
}

/** Soft-delete + mark inactive. */
export function softDeleteEmployee(id: string) {
  return prisma.employee.update({
    where: { id },
    data: { deletedAt: new Date(), employmentStatus: "inactive" },
  });
}

/** List distinct department names for filter dropdowns. */
export async function findDepartments(): Promise<string[]> {
  const rows = await prisma.employee.findMany({
    where: { deletedAt: null },
    distinct: ["department"],
    select: { department: true },
    orderBy: { department: "asc" },
  });
  return rows.map((r) => r.department);
}
