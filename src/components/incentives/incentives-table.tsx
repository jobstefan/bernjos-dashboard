"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { cancelIncentiveAction } from "@/app/actions/incentive.actions";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import type { IncentiveRow, IncentiveStatus } from "@/lib/types/payroll";

const ALL = "__all__";

const STATUS_OPTIONS: [IncentiveStatus, string][] = [
  ["pending", "Pending"],
  ["applied", "Applied"],
  ["cancelled", "Cancelled"],
];

function statusColor(status: IncentiveStatus): string {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400";
    case "applied":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400";
    case "cancelled":
      return "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400";
  }
}

function StatusPill({ status }: { status: IncentiveStatus }) {
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

export function IncentivesTable({ rows }: { rows: IncentiveRow[] }) {
  const router = useRouter();
  const [status, setStatus] = React.useState(ALL);
  const [search, setSearch] = React.useState("");
  const [toCancel, setToCancel] = React.useState<IncentiveRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== ALL && r.status !== status) return false;
      if (
        q &&
        !r.employeeName.toLowerCase().includes(q) &&
        !r.employeeCode.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, status, search]);

  const columns = React.useMemo<ColumnDef<IncentiveRow>[]>(() => {
    return [
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
      {
        accessorKey: "amount",
        header: "Amount",
        cell: ({ row }) => (
          <span className="font-mono">{formatPeso(row.original.amount)}</span>
        ),
      },
      {
        accessorKey: "branchName",
        header: "Branch",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.branchName ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-xs text-sm text-muted-foreground">
            {row.original.reason ?? "—"}
          </span>
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
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => {
          const incentive = row.original;
          if (incentive.status !== "pending") return null;
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
                  onClick={() => setToCancel(incentive)}
                >
                  Cancel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
  }, []);

  const CSV_COLUMNS = [
    { header: "Employee", accessor: (r: IncentiveRow) => r.employeeName },
    { header: "Code", accessor: (r: IncentiveRow) => r.employeeCode },
    { header: "Branch", accessor: (r: IncentiveRow) => r.branchName ?? "" },
    { header: "Amount", accessor: (r: IncentiveRow) => r.amount },
    { header: "Reason", accessor: (r: IncentiveRow) => r.reason ?? "" },
    { header: "Status", accessor: (r: IncentiveRow) => r.status },
    { header: "Applied In", accessor: (r: IncentiveRow) => r.appliedPeriodLabel ?? "" },
    { header: "Created", accessor: (r: IncentiveRow) => r.createdAt.slice(0, 10) },
  ];

  return (
    <div className="space-y-4">
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
            options: STATUS_OPTIONS,
          },
        ]}
        onExport={() => exportToCsv("incentives", CSV_COLUMNS, filtered)}
      />

      <DataTable
        columns={columns}
        data={filtered}
        initialSorting={[{ id: "createdAt", desc: true }]}
        renderCard={(row) => (
          <DataCard
            title={row.employeeName}
            subtitle={row.employeeCode}
            fields={[
              {
                label: "Amount",
                value: (
                  <span className="font-mono">{formatPeso(row.amount)}</span>
                ),
              },
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
          />
        )}
      />

      <AlertDialog
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this incentive?</AlertDialogTitle>
            <AlertDialogDescription>
              {toCancel
                ? `The ${formatPeso(toCancel.amount)} incentive for ${toCancel.employeeName} will be cancelled and will not be added to payroll.`
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
                  const res = await cancelIncentiveAction({ id: toCancel.id });
                  if (res.success) {
                    toast.success("Incentive cancelled.");
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
              {pending ? "Cancelling…" : "Cancel incentive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
