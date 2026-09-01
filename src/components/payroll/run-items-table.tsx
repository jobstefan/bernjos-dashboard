"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PayslipBreakdown,
  type PayslipView,
} from "@/components/payroll/payslip-breakdown";
import { updatePayslipRemarksAction } from "@/app/actions/payroll.actions";
import { formatPeso } from "@/lib/utils/payroll";
import { exportToCsv } from "@/lib/utils/csv";
import { toneClass } from "@/lib/utils/tone";

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
  lateDeduction: number;
  advanceDeduction: number;
  otherDeductions: number;
  loanDeduction: number;
  chargeDeduction?: number;
  otherEarnings: number;
  incentiveEarnings: number;
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
  daysWorked?: number;
  absentDays?: number;
  dayOffDays?: number;
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
  const [search, setSearch] = React.useState("");

  const hasLoanDeductions = React.useMemo(
    () => rows.some((r) => r.loanDeduction > 0),
    [rows],
  );

  const hasIncentiveEarnings = React.useMemo(
    () => rows.some((r) => r.incentiveEarnings > 0),
    [rows],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.employeeName.toLowerCase().includes(q) ||
        r.employeeCode.toLowerCase().includes(q) ||
        r.department.toLowerCase().includes(q),
    );
  }, [rows, search]);

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
      ...(hasLoanDeductions
        ? [
            {
              accessorKey: "loanDeduction",
              header: "Loan Ded.",
              enableSorting: false,
              cell: ({ row }: { row: { original: RunItemRow } }) =>
                money(row.original.loanDeduction),
            } satisfies ColumnDef<RunItemRow>,
          ]
        : []),
      {
        accessorKey: "otherEarnings",
        header: "Other Earn.",
        enableSorting: false,
        cell: ({ row }) => money(row.original.otherEarnings),
      },
      ...(hasIncentiveEarnings
        ? [
            {
              accessorKey: "incentiveEarnings",
              header: "Incentive",
              enableSorting: false,
              cell: ({ row }: { row: { original: RunItemRow } }) =>
                money(row.original.incentiveEarnings),
            } satisfies ColumnDef<RunItemRow>,
          ]
        : []),
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
              toneClass(row.original.status === "included" ? "success" : "neutral")
            }
          >
            {row.original.status}
          </span>
        ),
      },
    ],
    [hasLoanDeductions, hasIncentiveEarnings],
  );

  const view: PayslipView | null = selected ? { ...selected, periodLabel } : null;

  const CSV_COLUMNS = [
    { header: "Employee", accessor: (r: RunItemRow) => r.employeeName },
    { header: "Code", accessor: (r: RunItemRow) => r.employeeCode },
    { header: "Position", accessor: (r: RunItemRow) => r.position },
    { header: "Department", accessor: (r: RunItemRow) => r.department },
    { header: "Daily Rate", accessor: (r: RunItemRow) => r.basicSalary },
    { header: "Gross Pay", accessor: (r: RunItemRow) => r.grossPay },
    { header: "SSS", accessor: (r: RunItemRow) => r.sssEmployee },
    { header: "PhilHealth", accessor: (r: RunItemRow) => r.philhealthEmployee },
    { header: "Other Deductions", accessor: (r: RunItemRow) => r.otherDeductions },
    { header: "Loan Deduction", accessor: (r: RunItemRow) => r.loanDeduction },
    { header: "Charge Deduction", accessor: (r: RunItemRow) => r.chargeDeduction ?? 0 },
    { header: "Other Earnings", accessor: (r: RunItemRow) => r.otherEarnings },
    { header: "Incentive", accessor: (r: RunItemRow) => r.incentiveEarnings },
    { header: "Savings", accessor: (r: RunItemRow) => r.savingsContribution },
    { header: "Total Deductions", accessor: (r: RunItemRow) => r.totalDeductions },
    { header: "Net Pay", accessor: (r: RunItemRow) => r.netPay },
    { header: "Status", accessor: (r: RunItemRow) => r.status },
    { header: "Remarks", accessor: (r: RunItemRow) => r.remarks ?? "" },
  ];

  const remarksFooter = selected && canEditRemarks ? (
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
  ) : null;

  return (
    <div className="space-y-4">
      <DataToolbar
        search={{ value: search, onChange: setSearch, placeholder: "Search employee, code, department…" }}
        onExport={() => exportToCsv(`${periodLabel}-payroll`, CSV_COLUMNS, filtered)}
      />
      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => setSelected(row)}
        initialSorting={[{ id: "employeeName", desc: false }]}
        renderCard={(row) => (
          <DataCard
            title={row.employeeName}
            subtitle={`${row.employeeCode} · ${row.department}`}
            fields={[
              { label: "Gross", value: <span className="font-mono">{formatPeso(row.grossPay)}</span> },
              { label: "Net Pay", value: <span className="font-mono font-semibold">{formatPeso(row.netPay)}</span> },
              { label: "Daily Rate", value: <span className="font-mono">{formatPeso(row.basicSalary)}</span> },
            ]}
            actions={
              <span className={"inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " + toneClass(row.status === "included" ? "success" : "neutral")}>
                {row.status}
              </span>
            }
            onClick={() => setSelected(row)}
          />
        )}
      />
      <DetailDrawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Payslip"
        footer={remarksFooter}
      >
        {view ? <PayslipBreakdown payslip={view} /> : null}
      </DetailDrawer>
    </div>
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
    <div className="space-y-2">
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
