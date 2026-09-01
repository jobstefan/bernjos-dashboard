"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
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
import { SavingsAccountDialog } from "@/components/savings/savings-account-dialog";
import { SavingsAdjustmentDialog } from "@/components/savings/savings-adjustment-dialog";
import { SavingsLedger } from "@/components/savings/savings-ledger";
import { setSavingsFrozenAction } from "@/app/actions/savings.actions";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import { exportToCsv } from "@/lib/utils/csv";
import type { SavingsAccountRow } from "@/lib/types/savings";

const ALL = "__all__";

export function SavingsTable({
  rows,
  availableToBorrowMap = {},
}: {
  rows: SavingsAccountRow[];
  availableToBorrowMap?: Record<string, number>;
}) {
  const router = useRouter();
  const [toEdit, setToEdit] = React.useState<SavingsAccountRow | null>(null);
  const [toAdjust, setToAdjust] = React.useState<SavingsAccountRow | null>(null);
  const [toView, setToView] = React.useState<SavingsAccountRow | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [search, setSearch] = React.useState("");
  const [frozenFilter, setFrozenFilter] = React.useState<string>(ALL);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = rows.filter((r) => {
      if (frozenFilter === "active" && r.frozen) return false;
      if (frozenFilter === "frozen" && !r.frozen) return false;
      if (q && !r.employeeName.toLowerCase().includes(q) && !r.employeeCode.toLowerCase().includes(q)) return false;
      return true;
    });
    return result.sort((a, b) => Number(a.frozen) - Number(b.frozen));
  }, [rows, search, frozenFilter]);

  function toggleFrozen(acct: SavingsAccountRow, frozen: boolean) {
    startTransition(async () => {
      const res = await setSavingsFrozenAction({ accountId: acct.accountId, frozen });
      if (res.success) {
        toast.success(frozen ? "Account frozen." : "Account unfrozen.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  }

  const columns = React.useMemo<ColumnDef<SavingsAccountRow>[]>(
    () => [
      {
        accessorKey: "employeeName",
        header: "Employee",
        cell: ({ row }) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{row.original.employeeName}</span>
              {row.original.frozen ? (
                <Badge variant="secondary">Frozen</Badge>
              ) : null}
            </div>
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
        cell: ({ row }) => {
          const acct = row.original;
          const inactiveByEmployment = acct.frozen && !acct.frozenByAdmin;
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
                <DropdownMenuItem onClick={() => setToView(acct)}>
                  View history
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={acct.frozen}
                  onClick={() => setToEdit(acct)}
                >
                  Edit contribution
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setToAdjust(acct)}>
                  Record withdrawal / adjustment
                </DropdownMenuItem>
                {!inactiveByEmployment && (
                  <>
                    <DropdownMenuSeparator />
                    {acct.frozenByAdmin ? (
                      <DropdownMenuItem
                        disabled={pending}
                        onClick={() => toggleFrozen(acct, false)}
                      >
                        Unfreeze account
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        disabled={pending}
                        className="text-amber-600"
                        onClick={() => toggleFrozen(acct, true)}
                      >
                        Freeze account
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [],
  );

  const CSV_COLUMNS = [
    { header: "Employee", accessor: (r: SavingsAccountRow) => r.employeeName },
    { header: "Code", accessor: (r: SavingsAccountRow) => r.employeeCode },
    { header: "Contribution / Period", accessor: (r: SavingsAccountRow) => r.contributionAmount },
    { header: "Balance", accessor: (r: SavingsAccountRow) => r.balance },
    { header: "Status", accessor: (r: SavingsAccountRow) => (r.frozen ? "Frozen" : "Active") },
    { header: "Last Activity", accessor: (r: SavingsAccountRow) => r.lastActivityAt ?? "" },
  ];

  return (
    <div className="space-y-4">
      <DataToolbar
        search={{ value: search, onChange: setSearch, placeholder: "Search employee…" }}
        filters={[
          {
            value: frozenFilter,
            onChange: (v) => setFrozenFilter(v ?? ALL),
            placeholder: "Status",
            options: [["active", "Active"], ["frozen", "Frozen"]],
          },
        ]}
        onExport={() => exportToCsv("savings-accounts", CSV_COLUMNS, filtered)}
      />

      <DataTable
        columns={columns}
        data={filtered}
        initialSorting={[]}
        renderCard={(row) => (
          <DataCard
            title={row.employeeName}
            subtitle={row.employeeCode}
            fields={[
              { label: "Per period", value: <span className="font-mono">{formatPeso(row.contributionAmount)}</span> },
              { label: "Balance", value: <span className="font-mono font-semibold">{formatPeso(row.balance)}</span> },
              { label: "Status", value: row.frozen ? "Frozen" : "Active" },
              { label: "Last activity", value: row.lastActivityAt ? formatDate(row.lastActivityAt) : "—" },
            ]}
            onClick={() => setToView(row)}
          />
        )}
      />

      <DetailDrawer
        open={toView !== null}
        onOpenChange={(open) => !open && setToView(null)}
        title="Savings history"
        description={
          toView
            ? `${toView.employeeName} · ${toView.employeeCode} · balance ${formatPeso(toView.balance)}`
            : undefined
        }
        className="sm:max-w-lg"
      >
        {toView ? <SavingsLedger transactions={toView.transactions} compact /> : null}
      </DetailDrawer>

      <SavingsAccountDialog
        account={toEdit}
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
