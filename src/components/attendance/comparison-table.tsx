"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AttendanceEditDialog } from "@/components/attendance/attendance-edit-dialog";
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
  const [editingRow, setEditingRow] =
    React.useState<AttendanceComparisonRow | null>(null);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q) ||
        r.date.includes(q),
    );
  }, [rows, search]);

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
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {range(row.original.actualIn, row.original.actualOut)}
            {row.original.source === "draft" ? (
              <Badge variant="secondary" className="text-[10px]">Draft</Badge>
            ) : null}
            {row.original.source === "manual" ? (
              <Badge variant="outline" className="text-[10px]">Manual</Badge>
            ) : null}
            {row.original.needsReview ? (
              <Badge variant="destructive" className="text-[10px]">
                Review
              </Badge>
            ) : null}
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
        header: "Late / Undertime / Overtime / Out",
        enableSorting: false,
        cell: ({ row }) => {
          const { lateMinutes, undertimeMinutes, overtimeMinutes, breakMinutes, status } = row.original;
          const parts = [
            status === "late" ? `${lateMinutes}m late` : null,
            undertimeMinutes ? `${undertimeMinutes}m under` : null,
            overtimeMinutes ? `${overtimeMinutes}m overtime` : null,
            breakMinutes ? `${breakMinutes}m out` : null,
          ].filter(Boolean);
          if (parts.length === 0)
            return <span className="text-muted-foreground">—</span>;
          return <span className="text-sm">{parts.join(" · ")}</span>;
        },
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Edit attendance"
            title="Edit attendance"
            onClick={() => setEditingRow(row.original)}
          >
            <Pencil className="size-4" />
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataToolbar
        search={{ value: search, onChange: setSearch, placeholder: "Search by name, code, or date…" }}
      />
      <DataTable
        columns={columns}
        data={filtered}
        initialSorting={[{ id: "date", desc: true }]}
        renderCard={(row) => {
          const meta = STATUS_META[row.status];
          const varianceParts = [
            row.status === "late" ? `${row.lateMinutes}m late` : null,
            row.undertimeMinutes ? `${row.undertimeMinutes}m under` : null,
            row.overtimeMinutes ? `${row.overtimeMinutes}m overtime` : null,
            row.breakMinutes ? `${row.breakMinutes}m out` : null,
          ].filter(Boolean);
          return (
            <DataCard
              title={row.employeeName}
              subtitle={`${row.employeeCode} · ${row.date}`}
              fields={[
                { label: "Scheduled", value: <span className="text-muted-foreground">{row.scheduledStart && row.scheduledEnd ? `${row.scheduledStart} – ${row.scheduledEnd}` : "—"}</span> },
                { label: "Actual", value: <span className="text-muted-foreground">{row.actualIn && row.actualOut ? `${row.actualIn} – ${row.actualOut}` : "—"}</span> },
                {
                  label: "Variance",
                  value: varianceParts.length ? (
                    <div className="space-y-0.5">
                      {varianceParts.map((p, i) => <div key={i}>{p}</div>)}
                    </div>
                  ) : "—",
                },
              ]}
              actions={<Badge variant={meta.variant}>{meta.label}{row.status === "late" ? ` ${row.lateMinutes}m` : ""}</Badge>}
              onClick={() => setEditingRow(row)}
            />
          );
        }}
      />
      {editingRow ? (
        <AttendanceEditDialog
          key={`${editingRow.date}|${editingRow.employeeId}`}
          row={editingRow}
          open={editingRow !== null}
          onOpenChange={(open) => {
            if (!open) setEditingRow(null);
          }}
        />
      ) : null}
    </>
  );
}
