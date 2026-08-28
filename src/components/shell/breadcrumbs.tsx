"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Friendly labels for known route segments. */
const SEGMENT_LABELS: Record<string, string> = {
  payroll: "Payroll",
  payslips: "My Payslips",
  employees: "Employees",
  new: "New",
  edit: "Edit",
  schedule: "Schedule",
  mine: "Mine",
  attendance: "Attendance",
  branches: "Branches",
  departments: "Departments",
  "cash-advances": "Cash Advances",
  savings: "Savings",
  settings: "Settings",
  users: "Users",
};

function labelFor(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  // Opaque ids (cuid/uuid/numeric) → shortened token.
  if (/^[0-9a-f]{8,}$/i.test(segment) || /^\d+$/.test(segment)) {
    return segment.length > 10 ? `${segment.slice(0, 6)}…` : segment;
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((segment, i) => ({
    label: labelFor(segment),
    href: "/" + segments.slice(0, i + 1).join("/"),
    isLast: i === segments.length - 1,
  }));

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center gap-1 text-sm text-muted-foreground",
        className,
      )}
    >
      <Link href="/" className="transition-colors hover:text-foreground">
        Home
      </Link>
      {crumbs.map((crumb) => (
        <span key={crumb.href} className="flex items-center gap-1">
          <ChevronRight className="size-3.5 opacity-50" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
