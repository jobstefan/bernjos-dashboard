"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { MoreHorizontal, Search } from "lucide-react";
import { DataTable } from "@/components/payroll/data-table";
import { Input } from "@/components/ui/input";
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
import { deactivateEmployeeAction } from "@/app/actions/employee.actions";
import { formatPeso } from "@/lib/utils/payroll";

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

const STATUS_STYLES: Record<string, string> = {
  active: "border-green-200 bg-green-50 text-green-700",
  inactive: "border-slate-200 bg-slate-100 text-slate-600",
  resigned: "border-amber-200 bg-amber-50 text-amber-700",
  terminated: "border-red-200 bg-red-50 text-red-700",
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
  const [status, setStatus] = React.useState(ALL);
  const [toDeactivate, setToDeactivate] = React.useState<EmployeeRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (department !== ALL && r.department !== department) return false;
      if (status !== ALL && r.employmentStatus !== status) return false;
      if (
        q &&
        ![r.fullName, r.employeeCode, r.email, r.position]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
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
              (STATUS_STYLES[row.original.employmentStatus] ??
                "border-slate-200 bg-slate-100 text-slate-600")
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
                  onClick={() => setToDeactivate(row.original)}
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, code, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <FilterSelect
          value={department}
          onChange={setDepartment}
          placeholder="Department"
          options={departments.map((d) => [d, d] as [string, string])}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="Status"
          options={[
            ["active", "Active"],
            ["inactive", "Inactive"],
            ["resigned", "Resigned"],
            ["terminated", "Terminated"],
          ]}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/employees/${row.id}`)}
        initialSorting={[{ id: "fullName", desc: false }]}
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

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: [string, string][];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {placeholder.toLowerCase()}</SelectItem>
        {options.map(([val, labelText]) => (
          <SelectItem key={val} value={val}>
            {labelText}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
