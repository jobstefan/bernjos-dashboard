"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { DeletionFooter } from "@/components/ui/deletion-footer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ChargeSlip } from "@/components/charges/charge-slip";
import { exportToCsv } from "@/lib/utils/csv";
import {
  cancelChargeAction,
  cancelChargeDeletionRequestAction,
  deleteChargeAction,
  requestChargeDeletionAction,
} from "@/app/actions/charge.actions";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import type { ChargeRow, ChargeStatus } from "@/lib/types/payroll";

const ALL = "__all__";

const ADMIN_STATUS_OPTIONS: [ChargeStatus, string][] = [
  ["pending", "Pending"],
  ["applied", "Applied"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

const ADMIN_HIDDEN_BY_DEFAULT = new Set<ChargeStatus>(["completed", "cancelled"]);

function statusColor(status: ChargeStatus): string {
  switch (status) {
    case "pending":   return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
    case "applied":   return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300";
    case "completed": return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300";
    case "cancelled": return "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400";
  }
}

function StatusPill({ status }: { status: ChargeStatus }) {
  return (
    <span
      className={
        "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " +
        statusColor(status)
      }
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function ChargesTable({
  rows,
  mode = "admin",
  canDelete = false,
  canRequestDeletion = false,
  canCancel = false,
}: {
  rows: ChargeRow[];
  mode?: "admin" | "mine";
  canDelete?: boolean;
  canRequestDeletion?: boolean;
  canCancel?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState(ALL);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<ChargeRow | null>(null);
  const [toCancel, setToCancel] = React.useState<ChargeRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    const slipId = searchParams.get("slip");
    if (slipId) {
      const match = rows.find((r) => r.id === slipId);
      if (match) setSelected(match);
    }
  }, [searchParams, rows]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Employee view: only show completed charges (deducted from approved payroll).
      if (mode === "mine" && r.status !== "completed") return false;
      // Admin view: hide completed and cancelled from the default "All" view.
      if (mode === "admin" && status === ALL && ADMIN_HIDDEN_BY_DEFAULT.has(r.status)) return false;
      if (mode === "admin" && status !== ALL && r.status !== status) return false;
      if (
        q &&
        !r.employeeName.toLowerCase().includes(q) &&
        !r.employeeCode.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, status, search, mode]);

  const columns = React.useMemo<ColumnDef<ChargeRow>[]>(() => {
    const cols: ColumnDef<ChargeRow>[] = [];
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
        accessorKey: "branchName",
        header: "Branch",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.branchName}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        accessorKey: "appliedPeriodLabel",
        header: "Applied In",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.appliedPeriodLabel ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    );
    if (canCancel) {
      cols.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const charge = row.original;
          if (charge.status !== "pending") return null;
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
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => { e.stopPropagation(); setToCancel(charge); }}
                >
                  Cancel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      });
    }
    return cols;
  }, [mode, canCancel]);

  const CSV_COLUMNS = [
    { header: "Employee", accessor: (r: ChargeRow) => r.employeeName },
    { header: "Code", accessor: (r: ChargeRow) => r.employeeCode },
    { header: "Branch", accessor: (r: ChargeRow) => r.branchName },
    { header: "Amount", accessor: (r: ChargeRow) => r.amount },
    { header: "Reason", accessor: (r: ChargeRow) => r.reason },
    { header: "Status", accessor: (r: ChargeRow) => r.status },
    { header: "Applied In", accessor: (r: ChargeRow) => r.appliedPeriodLabel ?? "" },
    { header: "Created", accessor: (r: ChargeRow) => r.createdAt.slice(0, 10) },
  ];

  return (
    <div className="space-y-4">
      {mode === "admin" && (
        <DataToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search employee…",
          }}
          filters={[
            {
              value: status,
              onChange: (v) => setStatus(v ?? ALL),
              placeholder: "Status",
              options: ADMIN_STATUS_OPTIONS,
            },
          ]}
          onExport={() => exportToCsv("charges", CSV_COLUMNS, filtered)}
        />
      )}

      <DataTable
        columns={columns}
        data={filtered}
        initialSorting={[{ id: "createdAt", desc: true }]}
        onRowClick={(row) => setSelected(row)}
        renderCard={(row) => (
          <DataCard
            title={mode === "admin" ? row.employeeName : formatPeso(row.amount)}
            subtitle={mode === "admin" ? row.employeeCode : formatDate(row.createdAt)}
            fields={[
              ...(mode === "admin"
                ? [{ label: "Amount", value: <span className="font-mono">{formatPeso(row.amount)}</span> }]
                : []),
              {
                label: "Reason",
                value: (
                  <span className="line-clamp-2 text-xs">{row.reason}</span>
                ),
              },
              {
                label: "Applied In",
                value: row.appliedPeriodLabel ?? "—",
              },
            ]}
            actions={<StatusPill status={row.status} />}
            onClick={() => setSelected(row)}
          />
        )}
      />

      {/* Detail slip */}
      <DetailDrawer
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        title="Charge"
        description={
          selected
            ? `${formatPeso(selected.amount)} · ${selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}`
            : undefined
        }
        footer={
          selected && mode === "admin" ? (
            <DeletionFooter
              canDelete={canDelete}
              canRequestDeletion={canRequestDeletion}
              deletionRequestedAt={selected.deletionRequestedAt}
              itemLabel={`${formatPeso(selected.amount)} charge for ${selected.employeeName}`}
              onRequestDeletion={() => requestChargeDeletionAction(selected.id)}
              onDelete={() => deleteChargeAction(selected.id)}
              onCancelDeletionRequest={() => cancelChargeDeletionRequestAction(selected.id)}
              onClose={() => setSelected(null)}
            />
          ) : undefined
        }
      >
        {selected && <ChargeSlip charge={selected} />}
      </DetailDrawer>

      {/* Cancel confirmation */}
      <AlertDialog
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this charge?</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel
                ? `The ${formatPeso(toCancel.amount)} charge for ${toCancel.employeeName} will be cancelled and will not be deducted from payroll.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!toCancel) return;
                startTransition(async () => {
                  const res = await cancelChargeAction(toCancel.id);
                  if (res.success) {
                    toast.success("Charge cancelled.");
                    setToCancel(null);
                    router.refresh();
                  } else {
                    toast.error(res.error ?? "Something went wrong.");
                  }
                });
              }}
              disabled={pending}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {pending ? "Cancelling…" : "Cancel charge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
