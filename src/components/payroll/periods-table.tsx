"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { StatusBadge } from "@/components/payroll/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import type { PayrollRunType, PayrollStatus } from "@/lib/types/payroll";

export interface PeriodRow {
  id: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  frequency: "semi_monthly" | "monthly";
  runType: PayrollRunType;
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
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.periodLabel}</span>
            {row.original.runType === "off_cycle" && (
              <Badge variant="outline">Off-cycle</Badge>
            )}
          </div>
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
      initialSorting={[{ id: "payDate", desc: true }]}
      renderCard={(row) => (
        <DataCard
          title={row.periodLabel}
          subtitle={`${formatDate(row.periodStart)} – ${formatDate(row.periodEnd)}`}
          fields={[
            { label: "Pay date", value: formatDate(row.payDate) },
            { label: "Frequency", value: row.frequency === "semi_monthly" ? "Semi-monthly" : "Monthly" },
            { label: "Employees", value: <span className="font-mono">{row.employeeCount}</span> },
            { label: "Total Net", value: <span className="font-mono">{formatPeso(row.totalNet)}</span> },
          ]}
          actions={
            <div className="flex items-center gap-2">
              {row.runType === "off_cycle" && (
                <Badge variant="outline">Off-cycle</Badge>
              )}
              <StatusBadge status={row.status} />
            </div>
          }
          onClick={() => router.push(`/payroll/${row.id}`)}
        />
      )}
    />
  );
}
