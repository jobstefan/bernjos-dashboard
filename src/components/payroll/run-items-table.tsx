"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/payroll/data-table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PayslipBreakdown,
  type PayslipView,
} from "@/components/payroll/payslip-breakdown";
import { updatePayslipRemarksAction } from "@/app/actions/payroll.actions";
import { formatPeso } from "@/lib/utils/payroll";

export interface RunItemRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  position: string;
  department: string;
  basicSalary: number;
  grossPay: number;
  sssEmployee: number;
  philhealthEmployee: number;
  otherDeductions: number;
  otherEarnings: number;
  savingsContribution: number;
  totalDeductions: number;
  netPay: number;
  status: "included" | "excluded";
  remarks: string | null;
  branchBreakdown: {
    branchName: string;
    daysWorked: number;
    netPay: number;
  }[];
}

const money = (v: number) => (
  <span className="font-mono">{formatPeso(v)}</span>
);

export function RunItemsTable({
  rows,
  periodLabel,
  canEditRemarks = false,
}: {
  rows: RunItemRow[];
  periodLabel: string;
  canEditRemarks?: boolean;
}) {
  const [selected, setSelected] = React.useState<RunItemRow | null>(null);

  const columns = React.useMemo<ColumnDef<RunItemRow>[]>(
    () => [
      {
        accessorKey: "employeeName",
        header: "Employee",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.employeeName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.employeeCode}
            </div>
          </div>
        ),
      },
      { accessorKey: "position", header: "Position", enableSorting: false },
      {
        accessorKey: "basicSalary",
        header: "Daily Rate",
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
        accessorKey: "savingsContribution",
        header: "Savings",
        enableSorting: false,
        cell: ({ row }) => money(row.original.savingsContribution),
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
          <div className="space-y-6 overflow-y-auto px-4 pb-6">
            {view ? <PayslipBreakdown payslip={view} /> : null}
            {selected && canEditRemarks ? (
              <RemarksEditor
                key={selected.id}
                runItemId={selected.id}
                initial={selected.remarks}
                onSaved={(remarks) =>
                  setSelected((cur) =>
                    cur && cur.id === selected.id ? { ...cur, remarks } : cur,
                  )
                }
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function RemarksEditor({
  runItemId,
  initial,
  onSaved,
}: {
  runItemId: string;
  initial: string | null;
  onSaved: (remarks: string | null) => void;
}) {
  const [value, setValue] = React.useState(initial ?? "");
  const [pending, startTransition] = React.useTransition();
  const dirty = value.trim() !== (initial ?? "");

  function save() {
    startTransition(async () => {
      const res = await updatePayslipRemarksAction({ runItemId, remarks: value });
      if (res.success) {
        onSaved(value.trim() || null);
        toast.success("Remark saved.");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-2 border-t pt-4">
      <Label htmlFor="payslip-remarks" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Remarks
      </Label>
      <Textarea
        id="payslip-remarks"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a remark shown on this employee's payslip…"
        rows={3}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || pending}>
          {pending ? "Saving…" : "Save remark"}
        </Button>
      </div>
    </div>
  );
}
