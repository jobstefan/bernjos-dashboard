"use client";

import { Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

export interface ToolbarFilter {
  value: string;
  onChange: (v: string | null) => void;
  placeholder: string;
  options: [value: string, label: string][];
}

export interface DataToolbarProps {
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  filters?: ToolbarFilter[];
  onExport?: () => void;
  children?: React.ReactNode;
}

export function DataToolbar({ search, filters, onExport, children }: DataToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {search && (
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={search.placeholder ?? "Search…"}
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      {filters?.map((filter) => (
        <Select
          key={filter.placeholder}
          value={filter.value}
          onValueChange={filter.onChange}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={filter.placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All {filter.placeholder.toLowerCase()}</SelectItem>
            {filter.options.map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      <div className="ml-auto flex items-center gap-2">
        {children}
        {onExport && (
          <Button variant="outline" size="sm" onClick={onExport}>
            <Download className="size-4" /> Export CSV
          </Button>
        )}
      </div>
    </div>
  );
}
