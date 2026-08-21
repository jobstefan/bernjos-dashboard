import type { CashAdvanceStatus, PayrollStatus } from "@/lib/types/payroll";

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format a peso amount as `₱ 1,234.56`. Accepts number, string, or any Decimal
 * with a `toString()` (e.g. Prisma.Decimal).
 */
export function formatPeso(amount: number | string | { toString(): string }): string {
  const value =
    typeof amount === "number"
      ? amount
      : Number.parseFloat(amount.toString());
  const safe = Number.isFinite(value) ? value : 0;
  return `₱ ${pesoFormatter.format(safe)}`;
}

export function getPayrollStatusLabel(status: PayrollStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "calculated":
      return "Calculated";
    case "pending_approval":
      return "Pending Approval";
    case "approved":
      return "Approved";
    case "paid":
      return "Paid";
    default:
      return status;
  }
}

/**
 * Tailwind classes (bg tint + text) for a status pill. Uses the palette from the
 * design system: draft=gray, calculated=blue, pending=amber, approved=green,
 * paid=emerald.
 */
export function getPayrollStatusColor(status: PayrollStatus): string {
  switch (status) {
    case "draft":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "calculated":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "pending_approval":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "approved":
      return "bg-green-50 text-green-700 border-green-200";
    case "paid":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function getCashAdvanceStatusLabel(status: CashAdvanceStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    case "applied":
      return "Applied";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

/**
 * Tailwind classes (bg tint + text + border) for a cash-advance status pill.
 * pending=amber, approved=green, declined=rose, applied=emerald, cancelled=slate.
 */
export function getCashAdvanceStatusColor(status: CashAdvanceStatus): string {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "approved":
      return "bg-green-50 text-green-700 border-green-200";
    case "declined":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "applied":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "cancelled":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

/** Format a Date as `Jul 1, 2025`. */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
