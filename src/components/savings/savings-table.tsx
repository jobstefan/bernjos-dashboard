"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SavingsAccountDialog,
  type EmployeeOption,
} from "@/components/savings/savings-account-dialog";
import { SavingsAdjustmentDialog } from "@/components/savings/savings-adjustment-dialog";
import { SavingsLedger } from "@/components/savings/savings-ledger";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import type { SavingsAccountRow } from "@/lib/types/savings";

export function SavingsTable({
  rows,
  employees,
}: {
  rows: SavingsAccountRow[];
  employees: EmployeeOption[];
}) {
  const [toEdit, setToEdit] = React.useState<SavingsAccountRow | null>(null);
  const [toAdjust, setToAdjust] = React.useState<SavingsAccountRow | null>(null);
  const [toView, setToView] = React.useState<SavingsAccountRow | null>(null);

  const columns = React.useMemo<ColumnDef<SavingsAccountRow>[]>(
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
      {
        accessorKey: "contributionAmount",
        header: "Per period",
        cell: ({ row }) => (
          <span className="font-mono">
            {formatPeso(row.original.contributionAmount)}
          </span>
        ),
      },
      {
        accessorKey: "balance",
        header: "Balance",
        cell: ({ row }) => (
          <span className="font-mono font-semibold">
            {formatPeso(row.original.balance)}
          </span>
        ),
      },
      {
        accessorKey: "active",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={row.original.active ? "default" : "secondary"}>
            {row.original.active ? "Active" : "Paused"}
          </Badge>
        ),
      },
      {
        accessorKey: "lastActivityAt",
        header: "Last activity",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.lastActivityAt
              ? formatDate(row.original.lastActivityAt)
              : "—"}
          </span>
        ),
      },
      {
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
              <DropdownMenuItem onClick={() => setToView(row.original)}>
                View history
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setToEdit(row.original)}>
                Edit contribution
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setToAdjust(row.original)}>
                Record withdrawal / adjustment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={rows}
        initialSorting={[{ id: "employeeName", desc: false }]}
      />

      <Sheet
        open={toView !== null}
        onOpenChange={(open) => !open && setToView(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Savings history</SheetTitle>
            <SheetDescription>
              {toView
                ? `${toView.employeeName} · ${toView.employeeCode} · balance ${formatPeso(toView.balance)}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto px-4 pb-6">
            {toView ? (
              <SavingsLedger transactions={toView.transactions} />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <SavingsAccountDialog
        account={toEdit}
        employees={employees}
        open={toEdit !== null}
        onOpenChange={(open) => !open && setToEdit(null)}
      />

      <SavingsAdjustmentDialog
        account={toAdjust}
        onOpenChange={(open) => !open && setToAdjust(null)}
      />
    </div>
  );
}
