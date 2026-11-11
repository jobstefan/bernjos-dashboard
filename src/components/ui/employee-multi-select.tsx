"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatEmployeeName } from "@/lib/utils/format-name";
import type { EmploymentStatus } from "@/generated/prisma/enums";

export interface EmployeeSelectOption {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  employmentStatus: EmploymentStatus;
}

interface Props {
  employees: EmployeeSelectOption[];
  value: string[];
  onValueChange: (ids: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const STATUS_LABEL: Partial<Record<EmploymentStatus, string>> = {
  inactive: "Inactive",
  resigned: "Resigned",
  terminated: "Terminated",
};

export function EmployeeMultiSelect({
  employees,
  value,
  onValueChange,
  placeholder = "Search employees…",
  disabled,
  className,
}: Props) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = React.useMemo(
    () => employees.filter((e) => value.includes(e.id)),
    [employees, value],
  );

  const filtered = React.useMemo(() => {
    if (!query.trim()) return employees;
    const q = query.toLowerCase();
    return employees.filter(
      (e) =>
        formatEmployeeName(e.firstName, e.lastName, e.middleName)
          .toLowerCase()
          .includes(q) ||
        e.employeeCode.toLowerCase().includes(q),
    );
  }, [employees, query]);

  function toggle(id: string) {
    if (value.includes(id)) {
      onValueChange(value.filter((v) => v !== id));
    } else {
      onValueChange([...value, id]);
    }
  }

  function handleBlur(e: React.FocusEvent) {
    if (containerRef.current?.contains(e.relatedTarget as Node)) return;
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          disabled && "cursor-not-allowed opacity-50",
        )}
        onClick={() => {
          if (!disabled) {
            setOpen(true);
            inputRef.current?.focus();
          }
        }}
      >
        {selected.map((e) => (
          <span
            key={e.id}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs font-medium"
          >
            {formatEmployeeName(e.firstName, e.lastName, e.middleName)}
            <button
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={(ev) => {
                ev.stopPropagation();
                toggle(e.id);
              }}
              className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder={selected.length === 0 ? placeholder : ""}
          disabled={disabled}
          autoComplete="off"
          className="min-w-24 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
      </div>

      {open && (
        <div className="absolute top-full z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover shadow-md ring-1 ring-foreground/10">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              No results found.
            </p>
          ) : (
            filtered.map((e) => {
              const isSelected = value.includes(e.id);
              const statusLabel = STATUS_LABEL[e.employmentStatus];
              return (
                <button
                  key={e.id}
                  type="button"
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => toggle(e.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                    isSelected && "bg-accent/50",
                  )}
                >
                  <CheckIcon
                    className={cn(
                      "size-4 shrink-0",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="font-medium">
                    {formatEmployeeName(e.firstName, e.lastName, e.middleName)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {e.employeeCode}
                  </span>
                  {statusLabel && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {statusLabel}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
