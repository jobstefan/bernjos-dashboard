"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
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
import { formatPeso } from "@/lib/utils/payroll";

export interface RunItemRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  position: string;
  department: string;
  tin: string | null;
  basicSalary: number;
  grossPay: number;
  sssEmployee: number;
  philhealthEmployee: number;
  pagibigEmployee: number;
  birWithholding: number;
  otherDeductions: number;
  otherEarnings: number;
  totalDeductions: number;
  netPay: number;
  status: "included" | "excluded";
}

const money = (v: number) => (
  <span className="font-mono">{formatPeso(v)}</span>
);

export function RunItemsTable({
  rows,
  periodLabel,
}: {
  rows: RunItemRow[];
  periodLabel: string;
}) {
  const [selected, setSelected] = React.useState<RunItemRow | null>(null);

  const columns = React.useMemo<ColumnDef<RunItemRow>[]>(
    () => [
      {
        accessorKey: "employeeName",
        header: "Employee",
        cell: ({ row }) => (
          <div>
            <div className="flex items-center gap-1.5 font-medium">
              {row.original.employeeName}
              {!row.original.tin ? (
                <span
                  title="Missing TIN"
                  className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                >
                  <AlertTriangle className="mr-0.5 size-2.5" /> TIN
                </span>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">
              {row.original.employeeCode}
            </div>
          </div>
        ),
      },
      { accessorKey: "position", header: "Position", enableSorting: false },
      {
        accessorKey: "basicSalary",
        header: "Basic",
        cell: ({ row }) => money(row.original.basicSalary),
      },
      {
        accessorKey: "grossPay",
        header: "Gross",
        cell: ({ row }) => money(row.original.grossPay),
      },
      {
        accessorKey: "sssEmployee",
        header: "SSS",
        cell: ({ row }) => money(row.original.sssEmployee),
      },
      {
        accessorKey: "philhealthEmployee",
        header: "PhilHealth",
        cell: ({ row }) => money(row.original.philhealthEmployee),
      },
      {
        accessorKey: "pagibigEmployee",
        header: "Pag-IBIG",
        cell: ({ row }) => money(row.original.pagibigEmployee),
      },
      {
        accessorKey: "birWithholding",
        header: "BIR Tax",
        cell: ({ row }) => money(row.original.birWithholding),
      },
      {
        accessorKey: "otherDeductions",
        header: "Other Ded.",
        enableSorting: false,
        cell: ({ row }) => money(row.original.otherDeductions),
      },
      {
        accessorKey: "otherEarnings",
        header: "Other Earn.",
        enableSorting: false,
        cell: ({ row }) => money(row.original.otherEarnings),
      },
      {
        accessorKey: "netPay",
        header: "Net Pay",
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            {formatPeso(row.original.netPay)}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={
              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " +
              (row.original.status === "included"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-slate-200 bg-slate-100 text-slate-600")
            }
          >
            {row.original.status}
          </span>
        ),
      },
    ],
    [],
  );

  const view: PayslipView | null = selected
    ? { ...selected, periodLabel }
    : null;

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => setSelected(row)}
        initialSorting={[{ id: "employeeName", desc: false }]}
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
            {view ? <PayslipBreakdown payslip={view} /> : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
