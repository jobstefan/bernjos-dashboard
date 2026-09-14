"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, GitBranch } from "lucide-react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PayslipBreakdown,
  type PayslipView,
} from "@/components/payroll/payslip-breakdown";
import { BranchSplitBreakdown } from "@/components/payroll/branch-split-breakdown";
import { BranchSummaryDrawer } from "@/components/payroll/branch-summary-drawer";
import { updatePayslipRemarksAction, toggleRunItemStatusAction } from "@/app/actions/payroll.actions";
import type { BranchCashRow } from "@/server/services/analytics.service";
import { formatPeso } from "@/lib/utils/payroll";
import { exportToCsv, type CsvColumn } from "@/lib/utils/csv";
import { toneClass } from "@/lib/utils/tone";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  lateMinutes?: number;
  undertimeMinutes?: number;
  breakMinutes?: number;
}

const money = (v: number) => (
  <span className="font-mono">{formatPeso(v)}</span>
);

export function RunItemsTable({
  rows,
  periodLabel,
  canEditRemarks = false,
  branchCash,
}: {
  rows: RunItemRow[];
  periodLabel: string;
  canEditRemarks?: boolean;
  branchCash?: BranchCashRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<RunItemRow | null>(null);
  const [branchSplitRow, setBranchSplitRow] = React.useState<RunItemRow | null>(null);
  const [branchSummaryOpen, setBranchSummaryOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [, startStatusTransition] = React.useTransition();

  function handleToggleStatus(runItemId: string) {
    startStatusTransition(async () => {
      const res = await toggleRunItemStatusAction(runItemId);
      if (res.success) {
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

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
        id: "combinedEarnings",
        header: "Earnings",
        enableSorting: false,
        cell: ({ row }) =>
          money(row.original.otherEarnings + row.original.incentiveEarnings),
      },
      {
        id: "govtContrib",
        header: "Gov't Contrib.",
        enableSorting: false,
        cell: ({ row }) =>
          money(row.original.sssEmployee + row.original.philhealthEmployee),
      },
      {
        id: "deductions",
        header: "Deductions",
        enableSorting: false,
        cell: ({ row }) =>
          money(
            row.original.otherDeductions +
            row.original.loanDeduction +
            (row.original.chargeDeduction ?? 0) +
            row.original.savingsContribution,
          ),
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
        enableSorting: true,
        cell: ({ row }) => (
          <span className={"inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " + toneClass(row.original.status === "included" ? "success" : "neutral")}>
            {row.original.status}
          </span>
        ),
      },
      ...(canEditRemarks
        ? [{
            id: "actions",
            header: "",
            enableSorting: false,
            cell: ({ row }: { row: { original: RunItemRow } }) => {
              const isIncluded = row.original.status === "included";
              return (
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setBranchSplitRow(row.original)}>
                        View branch split
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(row.original.id)}
                        className={isIncluded ? "text-destructive focus:text-destructive" : ""}
                      >
                        {isIncluded ? "Exclude" : "Include"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            },
          } satisfies ColumnDef<RunItemRow>]
        : []),
    ],
    [canEditRemarks],
  );

  const view: PayslipView | null = selected ? { ...selected, periodLabel } : null;

  function getNetPaySource(r: RunItemRow): string {
    const branches = r.branchBreakdown.map((b) => {
      const netCash =
        branchCash
          ?.find((bc) => bc.branchName === b.branchName)
          ?.employees.find((e) => e.profileId === r.employeeId)
          ?.netCash ?? b.netPay;
      return { branchName: b.branchName, netCash };
    });

    const surpluses = branches.filter((b) => b.netCash > 0);
    const totalSurplus = Math.round(surpluses.reduce((s, b) => s + b.netCash, 0) * 100) / 100;
    const totalNetPay = Math.round(r.netPay * 100) / 100;

    if (Math.round(totalSurplus * 100) < Math.round(totalNetPay * 100)) return "Shortfall";

    const pool = surpluses.map((s) => ({ branchName: s.branchName, remaining: s.netCash }));
    const sources: { branchName: string; amount: number }[] = [];
    let stillNeed = totalNetPay;

    const singleCover = pool
      .filter((s) => s.remaining >= stillNeed)
      .sort((a, b) => a.remaining - b.remaining)[0];

    if (singleCover) {
      sources.push({ branchName: singleCover.branchName, amount: stillNeed });
    } else {
      for (const entry of [...pool].sort((a, b) => b.remaining - a.remaining)) {
        if (stillNeed <= 0) break;
        const take = Math.round(Math.min(entry.remaining, stillNeed) * 100) / 100;
        sources.push({ branchName: entry.branchName, amount: take });
        stillNeed = Math.round((stillNeed - take) * 100) / 100;
      }
    }

    if (sources.length === 1) return sources[0].branchName;
    return sources.map((s) => `${s.branchName} (PHP ${s.amount.toFixed(2)})`).join(" | ");
  }

  const BRANCH_CSV_COLUMNS: CsvColumn<RunItemRow>[] = [
    { header: "Employee", accessor: (r) => r.employeeName },
    { header: "Net Pay",  accessor: (r) => r.netPay },
    { header: "Pay From", accessor: (r) => getNetPaySource(r) },
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
        onExport={() => exportToCsv(`${periodLabel}-payroll`, BRANCH_CSV_COLUMNS, filtered)}
      >
        <Button variant="outline" size="sm" onClick={() => setBranchSummaryOpen(true)}>
          <GitBranch className="size-4" /> Branch Summary
        </Button>
      </DataToolbar>
      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => setSelected(row)}
        initialSorting={[{ id: "status", desc: true }, { id: "employeeName", desc: false }]}
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
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className={"inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " + toneClass(row.status === "included" ? "success" : "neutral")}>
                  {row.status}
                </span>
                {canEditRemarks && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setBranchSplitRow(row)}>
                        View branch split
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleToggleStatus(row.id)}
                        className={row.status === "included" ? "text-destructive focus:text-destructive" : ""}
                      >
                        {row.status === "included" ? "Exclude" : "Include"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
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

      <DetailDrawer
        open={branchSplitRow !== null}
        onOpenChange={(open) => !open && setBranchSplitRow(null)}
        title="Branch Split"
      >
        {branchSplitRow && (
          <BranchSplitBreakdown
            employeeName={branchSplitRow.employeeName}
            position={branchSplitRow.position}
            periodLabel={periodLabel}
            branches={branchSplitRow.branchBreakdown.map((b) => {
              const netCash = branchCash
                ?.find((r) => r.branchName === b.branchName)
                ?.employees.find((e) => e.profileId === branchSplitRow.employeeId)
                ?.netCash;
              return { ...b, netCash: netCash ?? b.netPay };
            })}
            totalNetPay={branchSplitRow.netPay}
          />
        )}
      </DetailDrawer>

      <BranchSummaryDrawer
        open={branchSummaryOpen}
        onOpenChange={setBranchSummaryOpen}
        periodLabel={periodLabel}
        rows={rows}
        branchCash={branchCash}
      />
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

