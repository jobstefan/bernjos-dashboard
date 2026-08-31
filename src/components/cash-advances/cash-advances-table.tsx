"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { CashAdvanceSlip } from "@/components/cash-advances/cash-advance-slip";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { exportToCsv } from "@/lib/utils/csv";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ApproveDialog,
  DeclineDialog,
} from "@/components/cash-advances/decision-dialogs";
import {
  cancelCashAdvanceAction,
  deleteCashAdvanceAction,
} from "@/app/actions/cash-advance.actions";
import {
  formatDate,
  formatPeso,
  getCashAdvanceStatusColor,
  getCashAdvanceStatusLabel,
} from "@/lib/utils/payroll";
import type { CashAdvanceRow, CashAdvanceStatus } from "@/lib/types/payroll";

const ALL = "__all__";

const STATUS_OPTIONS: [CashAdvanceStatus, string][] = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["declined", "Declined"],
  ["applied", "Applied"],
  ["cancelled", "Cancelled"],
];

function StatusPill({ status }: { status: CashAdvanceStatus }) {
  return (
    <span
      className={
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " +
        getCashAdvanceStatusColor(status)
      }
    >
      {getCashAdvanceStatusLabel(status)}
    </span>
  );
}

export function CashAdvancesTable({
  rows,
  mode,
  canApprove = false,
  canDelete = false,
  hideSearch = false,
}: {
  rows: CashAdvanceRow[];
  /** "admin" shows the employee column + approve/decline; "mine" shows cancel. */
  mode: "admin" | "mine";
  canApprove?: boolean;
  canDelete?: boolean;
  hideSearch?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState(ALL);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<CashAdvanceRow | null>(null);
  const [toApprove, setToApprove] = React.useState<CashAdvanceRow | null>(null);
  const [toDecline, setToDecline] = React.useState<CashAdvanceRow | null>(null);
  const [toCancel, setToCancel] = React.useState<CashAdvanceRow | null>(null);
  const [toDelete, setToDelete] = React.useState<CashAdvanceRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== ALL && r.status !== status) return false;
      if (q && !r.employeeName.toLowerCase().includes(q) && !r.employeeCode.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, status, search]);

  function runAction(
    action: () => Promise<{ success: boolean; error?: string }>,
    successMsg: string,
    done: () => void,
  ) {
    startTransition(async () => {
      const res = await action();
      if (res.success) {
        toast.success(successMsg);
        done();
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  const columns = React.useMemo<ColumnDef<CashAdvanceRow>[]>(() => {
    const cols: ColumnDef<CashAdvanceRow>[] = [];

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
        cell: ({ row }) => {
          const { amount, approvedAmount } = row.original;
          const showApproved =
            approvedAmount !== null && approvedAmount !== amount;
          return (
            <div>
              <span className="font-mono">
                {formatPeso(showApproved ? approvedAmount : amount)}
              </span>
              {showApproved ? (
                <div className="text-xs text-muted-foreground line-through">
                  {formatPeso(amount)}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "reason",
        header: "Reason",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-xs text-sm">{row.original.reason}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusPill status={row.original.status} />,
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
    );

    const showActions = canApprove || canDelete || mode === "mine";
    if (showActions) {
      cols.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const advance = row.original;
          const isPending = advance.status === "pending";
          const canApproveThis = canApprove && isPending;
          const canCancelThis = mode === "mine" && isPending;
          if (!canApproveThis && !canCancelThis && !canDelete) return null;
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
                {canApproveThis ? (
                  <>
                    <DropdownMenuItem onClick={() => setToApprove(advance)}>
                      Approve
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setToDecline(advance)}
                    >
                      Decline
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canCancelThis ? (
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setToCancel(advance)}
                  >
                    Cancel request
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <>
                    {canApproveThis || canCancelThis ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setToDelete(advance)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      });
    }

    return cols;
  }, [mode, canApprove, canDelete]);

  const CSV_COLUMNS = [
    { header: "Employee", accessor: (r: CashAdvanceRow) => r.employeeName },
    { header: "Code", accessor: (r: CashAdvanceRow) => r.employeeCode },
    { header: "Amount", accessor: (r: CashAdvanceRow) => r.approvedAmount ?? r.amount },
    { header: "Reason", accessor: (r: CashAdvanceRow) => r.reason },
    { header: "Status", accessor: (r: CashAdvanceRow) => r.status },
    { header: "Requested", accessor: (r: CashAdvanceRow) => r.requestedAt.slice(0, 10) },
  ];

  return (
    <div className="space-y-4">
      <DataToolbar
        search={mode === "admin" && !hideSearch ? { value: search, onChange: setSearch, placeholder: "Search employee…" } : undefined}
        filters={[{
          value: status,
          onChange: (v) => setStatus(v ?? ALL),
          placeholder: "Status",
          options: STATUS_OPTIONS,
        }]}
        onExport={() => exportToCsv("cash-advances", CSV_COLUMNS, filtered)}
      />

      <DataTable
        columns={columns}
        data={filtered}
        initialSorting={[{ id: "requestedAt", desc: true }]}
        onRowClick={(row) => setSelected(row)}
        renderCard={(row) => (
          <DataCard
            title={mode === "admin" ? row.employeeName : formatPeso(row.approvedAmount ?? row.amount)}
            subtitle={mode === "admin" ? row.employeeCode : formatDate(row.requestedAt)}
            fields={[
              { label: "Amount", value: <span className="font-mono">{formatPeso(row.approvedAmount ?? row.amount)}</span> },
              { label: "Reason", value: <span className="line-clamp-2 text-xs">{row.reason}</span> },
              { label: "Requested", value: formatDate(row.requestedAt) },
            ]}
            actions={<StatusPill status={row.status} />}
            onClick={() => setSelected(row)}
          />
        )}
      />

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Cash Advance"
        description={selected ? `${selected.employeeName} · ${selected.employeeCode}` : undefined}
      >
        {selected ? <CashAdvanceSlip advance={selected} /> : null}
      </DetailDrawer>

      <ApproveDialog
        advance={toApprove}
        onOpenChange={(open) => !open && setToApprove(null)}
      />
      <DeclineDialog
        advance={toDecline}
        onOpenChange={(open) => !open && setToDecline(null)}
      />

      <AlertDialog
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel
                ? `Your ${formatPeso(toCancel.amount)} request will be withdrawn. This cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep request</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!toCancel) return;
                runAction(
                  () => cancelCashAdvanceAction(toCancel.id),
                  "Request cancelled.",
                  () => setToCancel(null),
                );
              }}
              disabled={pending}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {pending ? "Cancelling…" : "Cancel request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `The ${formatPeso(toDelete.amount)} request from ${toDelete.employeeName} will be removed (soft delete).`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!toDelete) return;
                runAction(
                  () => deleteCashAdvanceAction(toDelete.id),
                  "Request deleted.",
                  () => setToDelete(null),
                );
              }}
              disabled={pending}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
