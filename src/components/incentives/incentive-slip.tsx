import { Separator } from "@/components/ui/separator";
import { formatDate, formatPeso } from "@/lib/utils/payroll";
import type { IncentiveRow, IncentiveStatus } from "@/lib/types/payroll";

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

function statusColor(status: IncentiveStatus): string {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400";
    case "applied":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400";
    case "cancelled":
      return "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400";
  }
}

export function IncentiveSlip({ incentive }: { incentive: IncentiveRow }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-base font-semibold">{incentive.employeeName}</div>
        <div className="text-xs text-muted-foreground">{incentive.employeeCode}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Created {formatDate(incentive.createdAt)}
        </div>
      </div>

      <Separator />

      <Section heading="Details">
        <Row
          label="Amount"
          value={<span className="font-mono">{formatPeso(incentive.amount)}</span>}
          emphasis
        />
        {incentive.branchName && (
          <Row label="Branch" value={incentive.branchName} />
        )}
        {incentive.reason && (
          <div className="py-1.5">
            <p className="mb-0.5 text-sm text-muted-foreground">Reason</p>
            <p className="text-sm">{incentive.reason}</p>
          </div>
        )}
      </Section>

      <Separator />

      <Section heading="Status">
        <Row
          label="Status"
          value={
            <span
              className={
                "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " +
                statusColor(incentive.status)
              }
            >
              {incentive.status.charAt(0).toUpperCase() + incentive.status.slice(1)}
            </span>
          }
        />
        {incentive.cancelledAt && (
          <Row label="Cancelled on" value={formatDate(incentive.cancelledAt)} />
        )}
      </Section>

      {incentive.appliedPeriodLabel && (
        <>
          <Separator />
          <Section heading="Payroll Application">
            <Row label="Applied to period" value={incentive.appliedPeriodLabel} emphasis />
            <p className="pt-1 text-xs text-muted-foreground">
              This incentive was added to the payroll run above.
            </p>
          </Section>
        </>
      )}
    </div>
  );
}
