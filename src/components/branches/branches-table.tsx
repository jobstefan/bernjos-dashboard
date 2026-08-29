"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { exportToCsv } from "@/lib/utils/csv";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { BranchDialog } from "@/components/branches/branch-dialog";
import { deleteBranchAction } from "@/app/actions/branch.actions";
import { formatDate } from "@/lib/utils/payroll";
import type { BranchRow } from "@/lib/types/schedule";

export function BranchesTable({
  rows,
  canManage = false,
}: {
  rows: BranchRow[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [toEdit, setToEdit] = React.useState<BranchRow | null>(null);
  const [toDelete, setToDelete] = React.useState<BranchRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.address ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const CSV_COLUMNS = [
    { header: "Branch", accessor: (r: BranchRow) => r.name },
    { header: "Address", accessor: (r: BranchRow) => r.address ?? "" },
    { header: "Added", accessor: (r: BranchRow) => formatDate(r.createdAt) },
  ];

  const columns = React.useMemo<ColumnDef<BranchRow>[]>(() => {
    const cols: ColumnDef<BranchRow>[] = [
      {
        accessorKey: "name",
        header: "Branch",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: "address",
        header: "Address",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.address ?? "—"}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Added",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
    ];

    if (canManage) {
      cols.push({
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setToEdit(row.original)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setToDelete(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      });
    }

    return cols;
  }, [canManage]);

  return (
    <div className="space-y-4">
      <DataToolbar
        search={{ value: search, onChange: setSearch, placeholder: "Search branch or address…" }}
        onExport={() => exportToCsv("branches", CSV_COLUMNS, filtered)}
      />
      <DataTable
        columns={columns}
        data={filtered}
        initialSorting={[{ id: "name", desc: false }]}
        renderCard={(row) => (
          <DataCard
            title={row.name}
            subtitle={row.address ?? "No address"}
            fields={[
              { label: "Added", value: formatDate(row.createdAt) },
            ]}
            actions={canManage ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm" aria-label="Row actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setToEdit(row)}>Edit</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setToDelete(row)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : undefined}
          />
        )}
      />

      <BranchDialog
        branch={toEdit}
        open={toEdit !== null}
        onOpenChange={(open) => !open && setToEdit(null)}
      />

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this branch?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `"${toDelete.name}" will be removed. Existing schedule entries keep their record but the branch won't be selectable.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!toDelete) return;
                startTransition(async () => {
                  const res = await deleteBranchAction(toDelete.id);
                  if (res.success) {
                    toast.success("Branch deleted.");
                    setToDelete(null);
                    router.refresh();
                  } else {
                    toast.error(res.error);
                  }
                });
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
