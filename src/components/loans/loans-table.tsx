"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ApproveLoanDialog,
  CancelLoanDialog,
  DeclineLoanDialog,
  DisburseLoanDialog,
} from "@/components/loans/loan-action-dialogs";
import { LoanRepaymentLedger } from "@/components/loans/loan-repayment-ledger";
import { DeletionFooter } from "@/components/ui/deletion-footer";
import { formatPeso } from "@/lib/utils/payroll";
import { toneClass } from "@/lib/utils/tone";
import { exportToCsv } from "@/lib/utils/csv";
import { deleteLoanAction, requestLoanDeletionAction } from "@/app/actions/loan.actions";
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
  canDelete = false,
  canRequestDeletion = false,
}: {
  rows: LoanRow[];
  mode?: "admin" | "mine";
  branches?: BranchOption[];
  canDelete?: boolean;
  canRequestDeletion?: boolean;
}) {
  const searchParams = useSearchParams();
  const [toApprove, setToApprove] = React.useState<LoanRow | null>(null);
  const [toDecline, setToDecline] = React.useState<LoanRow | null>(null);
  const [toDisburse, setToDisburse] = React.useState<LoanRow | null>(null);
  const [toCancel, setToCancel] = React.useState<LoanRow | null>(null);
  const [toView, setToView] = React.useState<LoanRow | null>(null);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    const slipId = searchParams.get("slip");
    if (slipId) {
      const match = rows.find((r) => r.id === slipId);
      if (match) setToView(match);
    }
  }, [searchParams, rows]);
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
          const hasActions =
            mode === "admin" && (loan.status === "pending" || loan.status === "approved");
          if (!hasActions) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Row actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                {loan.status === "pending" ? (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setToApprove(loan); }}>
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setToDecline(loan); }}>
                      Decline
                    </DropdownMenuItem>
                  </>
                ) : null}
                {loan.status === "approved" ? (
                  <>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setToDisburse(loan); }}>
                      Disburse
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setToCancel(loan); }}>
                      Cancel
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
        search={mode === "admin" ? {
          value: search,
          onChange: setSearch,
          placeholder: "Search employee…",
        } : undefined}
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
        onRowClick={(row) => setToView(row)}
        renderCard={(row) => (
          <DataCard
            title={mode === "admin" ? row.employeeName : formatPeso(row.amount)}
            subtitle={mode === "admin" ? row.employeeCode : formatDate(row.requestedAt)}
            fields={[
              mode === "admin"
                ? {
                    label: "Amount",
                    value: (
                      <span className="font-mono font-semibold">
                        {formatPeso(row.amount)}
                      </span>
                    ),
                  }
                : { label: "Reason", value: row.reason ?? "—" },
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
        title="Loan"
        description={
          toView
            ? `${toView.employeeName} · ${toView.employeeCode}`
            : undefined
        }
        className="sm:max-w-lg"
        footer={
          toView ? (
            <div className="space-y-2">
              {mode === "mine" && toView.status === "pending" && (
                <Button
                  variant="outline"
                  className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
                  onClick={() => setToCancel(toView)}
                >
                  Cancel request
                </Button>
              )}
              <DeletionFooter
                canDelete={canDelete}
                canRequestDeletion={canRequestDeletion}
                deletionRequestedAt={toView.deletionRequestedAt}
                itemLabel={`${formatPeso(toView.amount)} loan for ${toView.employeeName}`}
                onRequestDeletion={() => requestLoanDeletionAction(toView.id)}
                onDelete={() => deleteLoanAction(toView.id)}
                onClose={() => setToView(null)}
              />
            </div>
          ) : undefined
        }
      >
        {toView ? (
          <div className="space-y-4">
            {/* Loan summary */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-mono font-semibold">{formatPeso(toView.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Term</span>
                <span>{toView.termPeriods} period{toView.termPeriods > 1 ? "s" : ""}</span>
              </div>
              {(toView.status === "active" || toView.status === "completed") && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Installment</span>
                  <span className="font-mono">{formatPeso(toView.installmentAmount)}</span>
                </div>
              )}
              {toView.status === "active" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-mono">{formatPeso(toView.outstandingBalance)}</span>
                </div>
              )}
              {toView.branchName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Branch</span>
                  <span>{toView.branchName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <LoanStatusBadge status={toView.status} />
              </div>
              {toView.disbursedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Disbursed</span>
                  <span>{formatDate(toView.disbursedAt)}</span>
                </div>
              )}
            </div>
            {toView.reason && (
              <div>
                <p className="mb-0.5 text-sm text-muted-foreground">Reason</p>
                <p className="text-sm">{toView.reason}</p>
              </div>
            )}
            {toView.decisionNote ? (
              <div>
                <p className="mb-0.5 text-sm text-muted-foreground">Decision note</p>
                <p className="text-sm">{toView.decisionNote}</p>
              </div>
            ) : null}
            {toView.repayments.length > 0 && (
              <>
                <div className="border-t pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Repayment Schedule
                  </p>
                  <LoanRepaymentLedger
                    repayments={toView.repayments}
                    termPeriods={toView.termPeriods}
                  />
                </div>
              </>
            )}
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
        onSuccess={() => setToView(null)}
      />
    </div>
  );
}
