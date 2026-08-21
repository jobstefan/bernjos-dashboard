"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
}: {
  rows: CashAdvanceRow[];
  /** "admin" shows the employee column + approve/decline; "mine" shows cancel. */
  mode: "admin" | "mine";
  canApprove?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState(ALL);
  const [toApprove, setToApprove] = React.useState<CashAdvanceRow | null>(null);
  const [toDecline, setToDecline] = React.useState<CashAdvanceRow | null>(null);
  const [toCancel, setToCancel] = React.useState<CashAdvanceRow | null>(null);
  const [toDelete, setToDelete] = React.useState<CashAdvanceRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const filtered = React.useMemo(
    () => (status === ALL ? rows : rows.filter((r) => r.status === status)),
    [rows, status],
  );

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
        cell: ({ row }) => (
          <span className="font-mono">{formatPeso(row.original.amount)}</span>
        ),
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as string)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUS_OPTIONS.map(([val, labelText]) => (
              <SelectItem key={val} value={val}>
                {labelText}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        initialSorting={[{ id: "requestedAt", desc: true }]}
      />

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
