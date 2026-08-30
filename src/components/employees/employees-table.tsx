"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { DataCard } from "@/components/ui/data-card";
import { DataToolbar } from "@/components/ui/data-toolbar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { deactivateEmployeeAction } from "@/app/actions/employee.actions";
import { formatPeso } from "@/lib/utils/payroll";
import { toneClass, type Tone } from "@/lib/utils/tone";

export interface EmployeeRow {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  position: string;
  department: string;
  employmentStatus: string;
  basicSalary: number;
}

const ALL = "__all__";

const EMP_STATUS_TONE: Record<string, Tone> = {
  active: "success",
  inactive: "neutral",
  resigned: "warning",
  terminated: "danger",
};

export function EmployeesTable({
  rows,
  departments,
  canManage,
}: {
  rows: EmployeeRow[];
  departments: string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [department, setDepartment] = React.useState(ALL);
  const [status, setStatus] = React.useState("active");
  const [toDeactivate, setToDeactivate] = React.useState<EmployeeRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const STATUS_ORDER: Record<string, number> = { active: 0, inactive: 1, resigned: 2, terminated: 3 };

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (department !== ALL && r.department !== department) return false;
        if (status === "active_inactive") {
          if (!["active", "inactive"].includes(r.employmentStatus)) return false;
        } else if (status !== ALL) {
          if (r.employmentStatus !== status) return false;
        }
        if (
          q &&
          ![r.fullName, r.employeeCode, r.email, r.position]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          (STATUS_ORDER[a.employmentStatus] ?? 9) -
          (STATUS_ORDER[b.employmentStatus] ?? 9) ||
          a.fullName.localeCompare(b.fullName),
      );
  }, [rows, search, department, status]);

  function confirmDeactivate() {
    if (!toDeactivate) return;
    const id = toDeactivate.id;
    startTransition(async () => {
      const res = await deactivateEmployeeAction(id);
      if (res.success) {
        toast.success("Employee deactivated.");
        setToDeactivate(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  const columns = React.useMemo<ColumnDef<EmployeeRow>[]>(() => {
    const base: ColumnDef<EmployeeRow>[] = [
      {
        accessorKey: "fullName",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.fullName}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.employeeCode}
            </div>
          </div>
        ),
      },
      { accessorKey: "position", header: "Position" },
      { accessorKey: "department", header: "Department" },
      {
        accessorKey: "basicSalary",
        header: "Daily Rate",
        cell: ({ row }) => (
          <span className="font-mono">{formatPeso(row.original.basicSalary)}</span>
        ),
      },
      {
        accessorKey: "employmentStatus",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={
              "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize " +
              toneClass(EMP_STATUS_TONE[row.original.employmentStatus] ?? "neutral")
            }
          >
            {row.original.employmentStatus}
          </span>
        ),
      },
    ];

    base.push({
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
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
              onClick={() => router.push(`/employees/${row.original.id}`)}
            >
              View
            </DropdownMenuItem>
            {canManage ? (
              <>
                <DropdownMenuItem
                  onClick={() =>
                    router.push(`/employees/${row.original.id}/edit`)
                  }
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => { e.stopPropagation(); setToDeactivate(row.original); }}
                >
                  Deactivate
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });

    return base;
  }, [router, canManage]);

  const CSV_COLUMNS = [
    { header: "Name", accessor: (r: EmployeeRow) => r.fullName },
    { header: "Code", accessor: (r: EmployeeRow) => r.employeeCode },
    { header: "Position", accessor: (r: EmployeeRow) => r.position },
    { header: "Department", accessor: (r: EmployeeRow) => r.department },
    { header: "Daily Rate", accessor: (r: EmployeeRow) => r.basicSalary },
    { header: "Status", accessor: (r: EmployeeRow) => r.employmentStatus },
  ];

  return (
    <div className="space-y-4">
      <DataToolbar
        search={{ value: search, onChange: setSearch, placeholder: "Search name, code, email…" }}
        filters={[
          {
            value: department,
            onChange: (v) => setDepartment(v ?? ALL),
            placeholder: "Department",
            options: departments.map((d) => [d, d] as [string, string]),
          },
          {
            value: status,
            onChange: (v) => setStatus(v ?? ALL),
            placeholder: "Status",
            options: [
              ["active_inactive", "Active & Inactive"],
              ["active", "Active only"],
              ["inactive", "Inactive only"],
            ],
          },
        ]}
        onExport={() => exportToCsv("employees", CSV_COLUMNS, filtered)}
      />

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/employees/${row.id}`)}
        initialSorting={[{ id: "fullName", desc: false }]}
        renderCard={(row) => (
          <DataCard
            title={row.fullName}
            subtitle={`${row.employeeCode} · ${row.position}`}
            fields={[
              { label: "Department", value: row.department },
              { label: "Daily Rate", value: <span className="font-mono">{formatPeso(row.basicSalary)}</span> },
            ]}
            actions={
              <span className={"inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize " + toneClass(EMP_STATUS_TONE[row.employmentStatus] ?? "neutral")}>
                {row.employmentStatus}
              </span>
            }
            onClick={() => router.push(`/employees/${row.id}`)}
          />
        )}
      />

      <AlertDialog
        open={toDeactivate !== null}
        onOpenChange={(open) => !open && setToDeactivate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate employee?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDeactivate
                ? `${toDeactivate.fullName} will be marked inactive and excluded from future payroll runs. This is a soft delete and can be reversed by editing the record.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDeactivate();
              }}
              disabled={pending}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {pending ? "Deactivating…" : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

