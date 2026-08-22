"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/payroll/data-table";
import { Badge } from "@/components/ui/badge";
import type { AttendanceComparisonRow } from "@/lib/types/attendance";
import type { AttendanceStatus } from "@/lib/attendance/compare";

const STATUS_META: Record<
  AttendanceStatus,
  { label: string; variant: "secondary" | "destructive" | "outline" }
> = {
  present: { label: "Present", variant: "secondary" },
  late: { label: "Late", variant: "destructive" },
  absent: { label: "Absent", variant: "destructive" },
  "no-schedule": { label: "No schedule", variant: "outline" },
};

const range = (from: string | null, to: string | null) =>
  from || to ? `${from ?? "—"} – ${to ?? "—"}` : "—";

export function ComparisonTable({ rows }: { rows: AttendanceComparisonRow[] }) {
  const columns = React.useMemo<ColumnDef<AttendanceComparisonRow>[]>(
    () => [
      { accessorKey: "date", header: "Date" },
      {
        accessorKey: "employeeName",
        header: "Employee",
        cell: ({ row }) => (
          <div className="leading-tight">
            <div className="font-medium">{row.original.employeeName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.employeeCode}
            </div>
          </div>
        ),
      },
      {
        id: "scheduled",
        header: "Scheduled",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {range(row.original.scheduledStart, row.original.scheduledEnd)}
          </span>
        ),
      },
      {
        id: "actual",
        header: "Actual",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {range(row.original.actualIn, row.original.actualOut)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const { status, lateMinutes } = row.original;
          const meta = STATUS_META[status];
          return (
            <Badge variant={meta.variant}>
              {meta.label}
              {status === "late" ? ` ${lateMinutes}m` : ""}
            </Badge>
          );
        },
      },
      {
        id: "variance",
        header: "Late / Undertime",
        enableSorting: false,
        cell: ({ row }) => {
          const { lateMinutes, undertimeMinutes } = row.original;
          if (!lateMinutes && !undertimeMinutes)
            return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-sm">
              {lateMinutes ? `${lateMinutes}m late` : ""}
              {lateMinutes && undertimeMinutes ? " · " : ""}
              {undertimeMinutes ? `${undertimeMinutes}m under` : ""}
            </span>
          );
        },
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      initialSorting={[{ id: "date", desc: true }]}
    />
  );
}
