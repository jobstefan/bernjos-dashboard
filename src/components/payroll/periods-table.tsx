"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/payroll/data-table";
import { StatusBadge } from "@/components/payroll/status-badge";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import type { PayrollStatus } from "@/lib/types/payroll";

export interface PeriodRow {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  frequency: "semi_monthly" | "monthly";
  status: PayrollStatus;
  employeeCount: number;
  totalNet: number;
}

export function PeriodsTable({ rows }: { rows: PeriodRow[] }) {
  const router = useRouter();

  const columns = React.useMemo<ColumnDef<PeriodRow>[]>(
    () => [
      {
        accessorKey: "periodLabel",
        header: "Period",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.periodLabel}</div>
        ),
      },
      {
        id: "range",
        header: "Date range",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.periodStart)} –{" "}
            {formatDate(row.original.periodEnd)}
          </span>
        ),
      },
      {
        accessorKey: "payDate",
        header: "Pay date",
        cell: ({ row }) => formatDate(row.original.payDate),
      },
      {
        accessorKey: "frequency",
        header: "Frequency",
        cell: ({ row }) =>
          row.original.frequency === "semi_monthly" ? "Semi-monthly" : "Monthly",
      },
      {
        accessorKey: "employeeCount",
        header: "Employees",
        cell: ({ row }) => (
          <span className="font-mono">{row.original.employeeCount}</span>
        ),
      },
      {
        accessorKey: "totalNet",
        header: "Total Net Pay",
        cell: ({ row }) => (
          <span className="font-mono">{formatPeso(row.original.totalNet)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
    ],
    [],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      onRowClick={(row) => router.push(`/payroll/${row.id}`)}
      initialSorting={[{ id: "periodLabel", desc: true }]}
    />
  );
}
