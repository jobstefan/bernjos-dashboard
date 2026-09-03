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
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400";
    case "applied":
      return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-400";
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
