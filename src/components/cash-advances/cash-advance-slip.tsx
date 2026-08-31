import { Separator } from "@/components/ui/separator";
import {
  formatDate,
  formatPeso,
  getCashAdvanceStatusColor,
  getCashAdvanceStatusLabel,
} from "@/lib/utils/payroll";
import type { CashAdvanceRow, CashAdvanceStatus } from "@/lib/types/payroll";

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

export function CashAdvanceSlip({ advance }: { advance: CashAdvanceRow }) {
  const isDeclined = advance.status === "declined";
  const hasApprovedAmount =
    advance.approvedAmount !== null && advance.approvedAmount !== advance.amount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="text-base font-semibold">{advance.employeeName}</div>
        <div className="text-xs text-muted-foreground">{advance.employeeCode}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          Requested {formatDate(advance.requestedAt)}
        </div>
      </div>

      <Separator />

      {/* Request */}
      <Section heading="Request">
        <Row
          label="Amount requested"
          value={<span className="font-mono">{formatPeso(advance.amount)}</span>}
        />
        <div className="py-1.5">
          <p className="mb-0.5 text-sm text-muted-foreground">Reason</p>
          <p className="text-sm">{advance.reason}</p>
        </div>
      </Section>

      <Separator />

      {/* Decision */}
      <Section heading="Decision">
        <Row
          label="Status"
          value={
            <span
              className={
                "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium " +
                getCashAdvanceStatusColor(advance.status as CashAdvanceStatus)
              }
            >
              {getCashAdvanceStatusLabel(advance.status as CashAdvanceStatus)}
            </span>
          }
        />
        {hasApprovedAmount ? (
          <Row
            label="Approved amount"
            value={<span className="font-mono">{formatPeso(advance.approvedAmount!)}</span>}
            emphasis
          />
        ) : null}
        {advance.decidedAt ? (
          <Row label="Decided on" value={formatDate(advance.decidedAt)} />
        ) : null}
        {advance.decisionNote ? (
          <div className="py-1.5">
            <p className="mb-0.5 text-sm text-muted-foreground">
              {isDeclined ? "Decline reason" : "Note"}
            </p>
            <p className="text-sm">{advance.decisionNote}</p>
          </div>
        ) : null}
      </Section>

      {/* Applied to payroll */}
      {advance.appliedPeriodLabel ? (
        <>
          <Separator />
          <Section heading="Payroll Application">
            <Row label="Applied to period" value={advance.appliedPeriodLabel} emphasis />
            <p className="pt-1 text-xs text-muted-foreground">
              This advance was deducted from the payroll run above.
            </p>
          </Section>
        </>
      ) : advance.status === "approved" ? (
        <>
          <Separator />
          <Section heading="Payroll Application">
            <p className="py-1 text-sm text-muted-foreground">
              Pending — will be deducted on the next payroll run.
            </p>
          </Section>
        </>
      ) : null}
    </div>
  );
}
