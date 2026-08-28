import type { CashAdvanceStatus, PayrollStatus } from "@/lib/types/payroll";
import { toneClass } from "@/lib/utils/tone";

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

export function getPayrollStatusColor(status: PayrollStatus): string {
  switch (status) {
    case "draft":           return toneClass("neutral");
    case "calculated":      return toneClass("info");
    case "pending_approval": return toneClass("warning");
    case "approved":        return toneClass("success");
    case "paid":            return toneClass("success");
    default:                return toneClass("neutral");
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

export function getCashAdvanceStatusColor(status: CashAdvanceStatus): string {
  switch (status) {
    case "pending":   return toneClass("warning");
    case "approved":  return toneClass("success");
    case "declined":  return toneClass("danger");
    case "applied":   return toneClass("success");
    case "cancelled": return toneClass("neutral");
    default:          return toneClass("neutral");
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
