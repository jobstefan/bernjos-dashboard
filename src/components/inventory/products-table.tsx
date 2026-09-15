"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { Badge } from "@/components/ui/badge";
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
import { ProductDialog } from "@/components/inventory/product-dialog";
import { deleteProductAction } from "@/app/actions/inventory-catalog.actions";
import { formatPeso } from "@/lib/utils/payroll";
import type { CategoryRow, ProductRow } from "@/lib/types/inventory";

export function ProductsTable({
  rows,
  categories,
  canManage = false,
}: {
  rows: ProductRow[];
  categories: CategoryRow[];
  canManage?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("");
  const [toEdit, setToEdit] = React.useState<ProductRow | null>(null);
  const [toDelete, setToDelete] = React.useState<ProductRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if ((typeFilter === "sale" || typeFilter === "production") && r.type !== typeFilter)
        return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        r.unit.toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter]);

  const CSV_COLUMNS = [
    { header: "Product", accessor: (r: ProductRow) => r.name },
    { header: "Type", accessor: (r: ProductRow) => r.type },
    { header: "Category", accessor: (r: ProductRow) => r.categoryName },
    { header: "Unit", accessor: (r: ProductRow) => r.unit },
    { header: "Price", accessor: (r: ProductRow) => (r.price == null ? "" : String(r.price)) },
  ];

  const columns = React.useMemo<ColumnDef<ProductRow>[]>(() => {
    const cols: ColumnDef<ProductRow>[] = [
      {
        accessorKey: "name",
        header: "Product",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant={row.original.type === "sale" ? "default" : "secondary"}>
            {row.original.type === "sale" ? "Sale" : "Production"}
          </Badge>
        ),
      },
      {
        accessorKey: "categoryName",
        header: "Category",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.categoryName}</span>
        ),
      },
      {
        accessorKey: "unit",
        header: "Unit",
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{row.original.unit}</span>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.price == null ? "—" : formatPeso(row.original.price)}
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
              <DropdownMenuItem onClick={() => setToEdit(row.original)}>Edit</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setToDelete(row.original)}
              >
                Retire
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
        search={{ value: search, onChange: setSearch, placeholder: "Search product or category…" }}
        filters={[
          {
            value: typeFilter,
            onChange: (v) => setTypeFilter(v ?? ""),
            placeholder: "types",
            options: [
              ["sale", "Sale items"],
              ["production", "Production items"],
            ],
          },
        ]}
        onExport={() => exportToCsv("products", CSV_COLUMNS, filtered)}
      />
      <DataTable
        columns={columns}
        data={filtered}
        initialSorting={[{ id: "name", desc: false }]}
        renderCard={(row) => (
          <DataCard
            title={row.name}
            subtitle={`${row.categoryName} · ${row.type === "sale" ? "Sale" : "Production"}`}
            fields={[
              { label: "Unit", value: row.unit },
              { label: "Price", value: row.price == null ? "—" : formatPeso(row.price) },
            ]}
            actions={
              canManage ? (
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
                    <DropdownMenuItem className="text-destructive" onClick={() => setToDelete(row)}>
                      Retire
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : undefined
            }
          />
        )}
      />

      <ProductDialog
        product={toEdit}
        categories={categories}
        open={toEdit !== null}
        onOpenChange={(open) => !open && setToEdit(null)}
      />

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire this product?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `"${toDelete.name}" will be hidden from new counts. Historical inventory data is preserved.`
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
                  const res = await deleteProductAction(toDelete.id);
                  if (res.success) {
                    toast.success("Product retired.");
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
              {pending ? "Retiring…" : "Retire"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
