"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { StatusBadge } from "@/components/payroll/status-badge";
import {
  PayslipBreakdown,
  type PayslipView,
} from "@/components/payroll/payslip-breakdown";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import type { PayrollStatus } from "@/lib/types/payroll";

export interface PayslipHistoryRow extends PayslipView {
  id: string;
  payDate: string;
  status: PayrollStatus;
}

export function PayslipHistory({ rows }: { rows: PayslipHistoryRow[] }) {
  const [selected, setSelected] = React.useState<PayslipHistoryRow | null>(null);

  const columns = React.useMemo<ColumnDef<PayslipHistoryRow>[]>(
    () => [
      {
        accessorKey: "periodLabel",
        header: "Period",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.periodLabel}</span>
        ),
      },
      {
        accessorKey: "payDate",
        header: "Pay date",
        cell: ({ row }) => formatDate(row.original.payDate),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelected(row.original);
            }}
          >
            View Payslip
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => setSelected(row)}
        initialSorting={[{ id: "payDate", desc: true }]}
        renderCard={(row) => (
          <DataCard
            title={row.periodLabel}
            subtitle={formatDate(row.payDate)}
            fields={[
              { label: "Net pay", value: <span className="font-mono">{formatPeso(row.netPay)}</span> },
              { label: "Status", value: <StatusBadge status={row.status} /> },
            ]}
            actions={
              <Button variant="outline" size="sm" onClick={() => setSelected(row)}>
                View
              </Button>
            }
            onClick={() => setSelected(row)}
          />
        )}
      />
      <DetailDrawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Payslip"
      >
        {selected ? <PayslipBreakdown payslip={selected} /> : null}
      </DetailDrawer>
    </>
  );
}
