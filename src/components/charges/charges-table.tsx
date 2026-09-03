"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { DeletionFooter } from "@/components/ui/deletion-footer";
import { ChargeSlip } from "@/components/charges/charge-slip";
import { exportToCsv } from "@/lib/utils/csv";
import { deleteChargeAction, requestChargeDeletionAction } from "@/app/actions/charge.actions";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import type { ChargeRow, ChargeStatus } from "@/lib/types/payroll";

const ALL = "__all__";

const STATUS_OPTIONS: [ChargeStatus, string][] = [
  ["pending", "Pending"],
  ["applied", "Applied"],
];

function statusColor(status: ChargeStatus): string {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400";
    case "applied":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400";
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
}: {
  rows: ChargeRow[];
  mode?: "admin" | "mine";
  canDelete?: boolean;
  canRequestDeletion?: boolean;
}) {
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState(ALL);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<ChargeRow | null>(null);

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
    return cols;
  }, [mode]);

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
      <DataToolbar
        search={mode === "admin" ? {
          value: search,
          onChange: setSearch,
          placeholder: "Search employee…",
        } : undefined}
        filters={[
          {
            value: status,
            onChange: (v) => setStatus(v ?? ALL),
            placeholder: "Status",
            options: STATUS_OPTIONS,
          },
        ]}
        onExport={() => exportToCsv("charges", CSV_COLUMNS, filtered)}
      />

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
        description={selected ? `${selected.employeeName} · ${selected.employeeCode}` : undefined}
        footer={
          selected ? (
            <DeletionFooter
              canDelete={canDelete}
              canRequestDeletion={canRequestDeletion}
              deletionRequestedAt={selected.deletionRequestedAt}
              itemLabel={`${formatPeso(selected.amount)} charge for ${selected.employeeName}`}
              onRequestDeletion={() => requestChargeDeletionAction(selected.id)}
              onDelete={() => deleteChargeAction(selected.id)}
              onClose={() => setSelected(null)}
            />
          ) : undefined
        }
      >
        {selected && <ChargeSlip charge={selected} />}
      </DetailDrawer>
    </div>
  );
}
