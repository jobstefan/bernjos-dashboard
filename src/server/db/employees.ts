import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { ProfileFilters } from "@/lib/types/payroll";

/** Profiles linked to admin/super_admin Users are excluded from all employee queries. */
const EXCLUDE_ELEVATED: Prisma.UserProfileWhereInput = {
  OR: [{ userId: null }, { user: { role: { notIn: ["admin", "super_admin"] } } }],
};

/** Build a Prisma where-clause from profile filters (always excludes soft-deleted and elevated roles). */
function buildWhere(filters?: ProfileFilters): Prisma.UserProfileWhereInput {
  const where: Prisma.UserProfileWhereInput = { deletedAt: null, ...EXCLUDE_ELEVATED };
  if (filters?.department) where.department = filters.department;
  if (filters?.employmentStatus) where.employmentStatus = filters.employmentStatus;
  if (filters?.search) {
    const search = filters.search;
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { employeeCode: { contains: search, mode: "insensitive" } },
      { user: { email: { contains: search, mode: "insensitive" } } },
      { position: { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
}

const withUser = {
  user: { select: { email: true, clerkId: true } },
} satisfies Prisma.UserProfileInclude;

export function findEmployees(filters?: ProfileFilters) {
  return prisma.userProfile.findMany({
    where: buildWhere(filters),
    include: withUser,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export function findEmployeeById(id: string) {
  return prisma.userProfile.findFirst({
    where: { id, deletedAt: null, ...EXCLUDE_ELEVATED },
    include: withUser,
  });
}

/** Find a profile via its linked Clerk user id. */
export function findEmployeeByClerkId(clerkUserId: string) {
  return prisma.userProfile.findFirst({
    where: { user: { clerkId: clerkUserId }, deletedAt: null },
  });
}

export function findEmployeeByCode(employeeCode: string) {
  return prisma.userProfile.findFirst({ where: { employeeCode, deletedAt: null } });
}

/** Username uniqueness spans all rows (including soft-deleted) since the column
 * is globally unique in the DB. */
export function findEmployeeByUsername(username: string) {
  return prisma.userProfile.findUnique({ where: { username } });
}

export function findActiveEmployeesByFrequency(
  frequency: "semi_monthly" | "monthly",
) {
  return prisma.userProfile.findMany({
    where: {
      deletedAt: null,
      employmentStatus: "active",
      payFrequency: frequency,
      ...EXCLUDE_ELEVATED,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export function insertEmployee(data: Prisma.UserProfileCreateInput) {
  return prisma.userProfile.create({ data });
}

export function updateEmployeeRow(id: string, data: Prisma.UserProfileUpdateInput) {
  return prisma.userProfile.update({ where: { id }, data });
}

/** Soft-delete + mark inactive. */
export function softDeleteEmployee(id: string) {
  return prisma.userProfile.update({
    where: { id },
    data: { deletedAt: new Date(), employmentStatus: "inactive" },
  });
}

/** List distinct department names for filter dropdowns. */
export async function findDepartments(): Promise<string[]> {
  const rows = await prisma.userProfile.findMany({
    where: { deletedAt: null, ...EXCLUDE_ELEVATED },
    distinct: ["department"],
    select: { department: true },
    orderBy: { department: "asc" },
  });
  return rows.map((r) => r.department);
}
