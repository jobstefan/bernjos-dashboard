import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { InventoryEntryType } from "@/generated/prisma/enums";

// ── Sessions ──────────────────────────────────────────────────────────────

const sessionWithOperators = {
  operators: { orderBy: { startedAt: "asc" } },
} satisfies Prisma.InventorySessionInclude;

export function findSession(branchId: string, sessionDate: Date) {
  return prisma.inventorySession.findFirst({
    where: { branchId, sessionDate, deletedAt: null },
    include: sessionWithOperators,
  });
}

export function findSessionById(id: string) {
  return prisma.inventorySession.findFirst({
    where: { id, deletedAt: null },
    include: sessionWithOperators,
  });
}

export function createSession(branchId: string, sessionDate: Date, openedBy: string) {
  return prisma.inventorySession.create({
    data: { branchId, sessionDate, openedBy },
    include: sessionWithOperators,
  });
}

export function closeSessionRow(id: string, closedBy: string) {
  return prisma.inventorySession.update({
    where: { id },
    data: { closedBy, closedAt: new Date() },
  });
}

/** The most recent (closed or open) session strictly before `sessionDate`. */
export function findPreviousSession(branchId: string, sessionDate: Date) {
  return prisma.inventorySession.findFirst({
    where: { branchId, sessionDate: { lt: sessionDate }, deletedAt: null },
    orderBy: { sessionDate: "desc" },
  });
}

// ── Operator stints (handoff trail) ─────────────────────────────────────────

export function findActiveOperator(sessionId: string) {
  return prisma.inventorySessionOperator.findFirst({
    where: { sessionId, endedAt: null },
    orderBy: { startedAt: "desc" },
  });
}

export function attachOperator(sessionId: string, operatorId: string) {
  return prisma.inventorySessionOperator.create({ data: { sessionId, operatorId } });
}

export function endOpenOperatorStints(sessionId: string) {
  return prisma.inventorySessionOperator.updateMany({
    where: { sessionId, endedAt: null },
    data: { endedAt: new Date() },
  });
}

// ── Entries ──────────────────────────────────────────────────────────────

export function insertEntry(data: Prisma.InventoryEntryUncheckedCreateInput) {
  return prisma.inventoryEntry.create({ data });
}

export function insertEntries(data: Prisma.InventoryEntryCreateManyInput[]) {
  return prisma.inventoryEntry.createMany({ data });
}

export function findEntries(sessionId: string) {
  return prisma.inventoryEntry.findMany({
    where: { sessionId },
    orderBy: { enteredAt: "desc" },
  });
}

export function findEntriesOfType(sessionId: string, type: InventoryEntryType) {
  return prisma.inventoryEntry.findMany({
    // Superseded (admin-wins) offline entries are kept for the trail but never
    // feed derivations (§6).
    where: { sessionId, type, supersededBy: null },
    select: { productId: true, quantity: true },
  });
}

/** Sum quantity per (product, type) for a session — the raw material for on-hand. */
export function sumEntriesBySession(sessionId: string) {
  return prisma.inventoryEntry.groupBy({
    by: ["productId", "type"],
    where: { sessionId, supersededBy: null },
    _sum: { quantity: true },
  });
}

// ── Reporting & corrections ─────────────────────────────────────────────────

/** Sessions whose operating day falls in [from, to], optionally one branch. */
export function findSessionsInRange(from: Date, to: Date, branchId?: string) {
  return prisma.inventorySession.findMany({
    where: {
      deletedAt: null,
      sessionDate: { gte: from, lte: to },
      ...(branchId ? { branchId } : {}),
    },
    select: { id: true, branchId: true, sessionDate: true },
  });
}

/** Sum quantity per (product, type) across many sessions — the range aggregate. */
export function sumEntriesForSessions(sessionIds: string[]) {
  return prisma.inventoryEntry.groupBy({
    by: ["productId", "type"],
    where: { sessionId: { in: sessionIds }, supersededBy: null },
    _sum: { quantity: true },
  });
}

/** Closed sessions (for the admin corrections list), newest first. */
export function findClosedSessions(branchId?: string) {
  return prisma.inventorySession.findMany({
    where: { deletedAt: null, closedAt: { not: null }, ...(branchId ? { branchId } : {}) },
    include: { branch: { select: { name: true } } },
    orderBy: { sessionDate: "desc" },
    take: 60,
  });
}

/** Entries of a session joined with product info (for the corrections detail view). */
export function findEntriesWithProduct(sessionId: string) {
  return prisma.inventoryEntry.findMany({
    where: { sessionId },
    include: { product: { select: { name: true, unit: true } } },
    orderBy: [{ type: "asc" }, { enteredAt: "asc" }],
  });
}

export function findEntryById(id: string) {
  return prisma.inventoryEntry.findUnique({ where: { id } });
}

export function updateEntryQuantity(id: string, quantity: number) {
  return prisma.inventoryEntry.update({ where: { id }, data: { quantity } });
}
