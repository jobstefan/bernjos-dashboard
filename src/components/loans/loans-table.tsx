"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ApproveLoanDialog,
  CancelLoanDialog,
  DeclineLoanDialog,
  DisburseLoanDialog,
} from "@/components/loans/loan-action-dialogs";
import { LoanRepaymentLedger } from "@/components/loans/loan-repayment-ledger";
import { formatPeso } from "@/lib/utils/payroll";
import { toneClass } from "@/lib/utils/tone";
import { exportToCsv } from "@/lib/utils/csv";
import type { LoanRow, LoanStatus } from "@/lib/types/loan";
import type { Tone } from "@/lib/utils/tone";
import type { BranchOption } from "@/components/loans/create-loan-dialog";

const ALL = "__all__";

function loanStatusTone(status: LoanStatus): Tone {
  switch (status) {
    case "active": return "info";
    case "approved": return "warning";
    case "completed": return "success";
    case "cancelled": return "danger";
    default: return "neutral";
  }
}

function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return (
    <span
      className={
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize " +
        toneClass(loanStatusTone(status))
      }
    >
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function LoansTable({
  rows,
  mode = "admin",
  branches = [],
}: {
  rows: LoanRow[];
  mode?: "admin" | "mine";
  branches?: BranchOption[];
}) {
  const [toApprove, setToApprove] = React.useState<LoanRow | null>(null);
  const [toDecline, setToDecline] = React.useState<LoanRow | null>(null);
  const [toDisburse, setToDisburse] = React.useState<LoanRow | null>(null);
  const [toCancel, setToCancel] = React.useState<LoanRow | null>(null);
  const [toView, setToView] = React.useState<LoanRow | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>(ALL);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== ALL && r.status !== statusFilter) return false;
      if (
        q &&
        !r.employeeName.toLowerCase().includes(q) &&
        !r.employeeCode.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const columns = React.useMemo<ColumnDef<LoanRow>[]>(() => {
    const cols: ColumnDef<LoanRow>[] = [];

    if (mode === "admin") {
      cols.push({
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
      });
    }

    cols.push(
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            {formatPeso(row.original.amount)}
          </span>
        ),
      },
      {
        accessorKey: "termPeriods",
        header: "Term",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.termPeriods} period{row.original.termPeriods > 1 ? "s" : ""}
          </span>
        ),
      },
      {
        accessorKey: "installmentAmount",
        header: "Installment",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.status === "active" || row.original.status === "completed"
              ? formatPeso(row.original.installmentAmount)
              : "—"}
          </span>
        ),
      },
      {
        accessorKey: "outstandingBalance",
        header: "Outstanding",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-mono">
            {row.original.status === "active"
              ? formatPeso(row.original.outstandingBalance)
              : "—"}
          </span>
        ),
      },
      ...(mode === "admin"
        ? [
            {
              accessorKey: "branchName",
              header: "Branch",
              enableSorting: false,
              cell: ({ row }: { row: { original: LoanRow } }) => (
                <span className="text-sm text-muted-foreground">
                  {row.original.branchName ?? "—"}
                </span>
              ),
            } satisfies ColumnDef<LoanRow>,
          ]
        : []),
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <LoanStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "requestedAt",
        header: "Requested",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.requestedAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const loan = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setToView(loan)}>
                  View schedule
                </DropdownMenuItem>
                {mode === "admin" && loan.status === "pending" ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setToApprove(loan)}>
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setToDecline(loan)}>
                      Decline
                    </DropdownMenuItem>
                  </>
                ) : null}
                {mode === "admin" && loan.status === "approved" ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setToDisburse(loan)}>
                      Disburse
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setToCancel(loan)}>
                      Cancel
                    </DropdownMenuItem>
                  </>
                ) : null}
                {mode === "mine" && loan.status === "pending" ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setToCancel(loan)}>
                      Cancel request
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    );

    return cols;
  }, [mode]);

  const CSV_COLUMNS = [
    { header: "Employee", accessor: (r: LoanRow) => r.employeeName },
    { header: "Code", accessor: (r: LoanRow) => r.employeeCode },
    { header: "Branch", accessor: (r: LoanRow) => r.branchName ?? "" },
    { header: "Amount", accessor: (r: LoanRow) => r.amount },
    { header: "Term (periods)", accessor: (r: LoanRow) => r.termPeriods },
    { header: "Outstanding", accessor: (r: LoanRow) => r.outstandingBalance },
    { header: "Status", accessor: (r: LoanRow) => r.status },
    { header: "Requested", accessor: (r: LoanRow) => r.requestedAt },
  ];

  return (
    <div className="space-y-4">
      <DataToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: mode === "admin" ? "Search employee…" : "Search loans…",
        }}
        filters={[
          {
            value: statusFilter,
            onChange: (v) => setStatusFilter(v ?? ALL),
            placeholder: "Status",
            options: [
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["active", "Active"],
              ["completed", "Completed"],
              ["cancelled", "Cancelled"],
            ],
          },
        ]}
        onExport={() => exportToCsv("loans", CSV_COLUMNS, filtered)}
      />

      <DataTable
        columns={columns}
        data={filtered}
        initialSorting={[{ id: "requestedAt", desc: true }]}
        renderCard={(row) => (
          <DataCard
            title={mode === "admin" ? row.employeeName : row.reason}
            subtitle={mode === "admin" ? row.employeeCode : formatDate(row.requestedAt)}
            fields={[
              {
                label: "Amount",
                value: (
                  <span className="font-mono font-semibold">
                    {formatPeso(row.amount)}
                  </span>
                ),
              },
              { label: "Term", value: `${row.termPeriods} period${row.termPeriods > 1 ? "s" : ""}` },
              {
                label: "Status",
                value: <LoanStatusBadge status={row.status} />,
              },
              row.status === "active"
                ? {
                    label: "Outstanding",
                    value: (
                      <span className="font-mono">
                        {formatPeso(row.outstandingBalance)}
                      </span>
                    ),
                  }
                : { label: "Requested", value: formatDate(row.requestedAt) },
            ]}
            onClick={() => setToView(row)}
          />
        )}
      />

      <DetailDrawer
        open={toView !== null}
        onOpenChange={(open) => !open && setToView(null)}
        title="Loan repayment schedule"
        description={
          toView
            ? `${toView.employeeName} · ${formatPeso(toView.amount)} · ${toView.termPeriods} period${toView.termPeriods > 1 ? "s" : ""}`
            : undefined
        }
        className="sm:max-w-lg"
      >
        {toView ? (
          <div className="space-y-4">
            {toView.decisionNote ? (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium">Note:</span> {toView.decisionNote}
              </p>
            ) : null}
            <LoanRepaymentLedger
              repayments={toView.repayments}
              termPeriods={toView.termPeriods}
            />
          </div>
        ) : null}
      </DetailDrawer>

      <ApproveLoanDialog
        loan={toApprove}
        open={toApprove !== null}
        onOpenChange={(open) => !open && setToApprove(null)}
      />
      <DeclineLoanDialog
        loan={toDecline}
        open={toDecline !== null}
        onOpenChange={(open) => !open && setToDecline(null)}
      />
      <DisburseLoanDialog
        loan={toDisburse}
        open={toDisburse !== null}
        onOpenChange={(open) => !open && setToDisburse(null)}
        branches={branches}
      />
      <CancelLoanDialog
        loan={toCancel}
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
      />
    </div>
  );
}
