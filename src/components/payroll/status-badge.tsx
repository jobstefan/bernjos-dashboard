import { cn } from "@/lib/utils";
import {
  getPayrollStatusColor,
  getPayrollStatusLabel,
} from "@/lib/utils/payroll";
import type { PayrollStatus } from "@/lib/types/payroll";

export function StatusBadge({ status }: { status: PayrollStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        getPayrollStatusColor(status),
      )}
    >
      {getPayrollStatusLabel(status)}
    </span>
  );
}
