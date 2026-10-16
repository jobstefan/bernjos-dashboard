import { Separator } from "@/components/ui/separator";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import type { ChargeRow, ChargeStatus } from "@/lib/types/payroll";

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className={emphasis ? "font-medium text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={emphasis ? "font-semibold text-foreground text-right" : "text-right"}>
        {value}
      </span>
    </div>
  );
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </div>
      {children}
    </div>
  );
}

function statusColor(status: ChargeStatus): string {
  switch (status) {
    case "pending":   return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
    case "applied":   return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300";
    case "completed": return "border-green-200 bg-green-50 text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300";
    case "cancelled": return "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400";
  }
}

export function ChargeSlip({ charge }: { charge: ChargeRow }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-base font-semibold">{charge.employeeName}</div>
        <div className="text-xs text-muted-foreground">{charge.employeeCode}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Created {formatDate(charge.createdAt)}
        </div>
      </div>

      <Separator />

      <Section heading="Details">
        <Row
          label="Amount"
          value={<span className="font-mono">{formatPeso(charge.amount)}</span>}
          emphasis
        />
        <Row label="Branch" value={charge.branchName} />
        <div className="py-1.5">
          <p className="mb-0.5 text-sm text-muted-foreground">Reason</p>
          <p className="text-sm">{charge.reason}</p>
        </div>
      </Section>

      <Separator />

      <Section heading="Status">
        <Row
          label="Status"
          value={
            <span
              className={
                "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " +
                statusColor(charge.status)
              }
            >
              {charge.status.charAt(0).toUpperCase() + charge.status.slice(1)}
            </span>
          }
        />
        {charge.cancelledAt && (
          <Row label="Cancelled on" value={formatDate(charge.cancelledAt)} />
        )}
      </Section>

      {charge.appliedPeriodLabel && (
        <>
          <Separator />
          <Section heading="Payroll Application">
            <Row label="Applied to period" value={charge.appliedPeriodLabel} emphasis />
            <p className="pt-1 text-xs text-muted-foreground">
              This charge was deducted from the payroll run above.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}
