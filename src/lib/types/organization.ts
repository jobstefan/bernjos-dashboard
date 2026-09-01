import type {
  DepartmentModel,
  PositionModel,
} from "@/generated/prisma/models";

// Re-export the Prisma models under friendly app-layer names.
export type Department = DepartmentModel;
export type Position = PositionModel;

/** A position flattened for display in a table. */
export interface PositionRow {
  id: string;
  name: string;
  departmentId: string;
  shiftHours: number;
  createdAt: string;
}

/** A department flattened for display, with its live positions attached. */
export interface DepartmentRow {
  id: string;
  name: string;
  shiftHours: number;
  createdAt: string;
  positionCount: number;
}

export interface DepartmentWithPositions extends DepartmentRow {
  positions: PositionRow[];
}

/** Minimal option shape for populating the employee form dropdowns. */
export interface DepartmentOption {
  id: string;
  name: string;
  shiftHours: number;
  positions: { id: string; name: string; shiftHours: number }[];
}
