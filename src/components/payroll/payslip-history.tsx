"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/payroll/data-table";
import { StatusBadge } from "@/components/payroll/status-badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  PayslipBreakdown,
  type PayslipView,
} from "@/components/payroll/payslip-breakdown";
import { formatDate } from "@/lib/utils/payroll";
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
      />
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Payslip</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            {selected ? <PayslipBreakdown payslip={selected} /> : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
