import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Premium stat card: label, big tabular value, optional delta vs a prior
 * period, an optional icon, and a subtle brand sheen. Used across dashboards.
 */
export function KpiCard({
  label,
  value,
  delta,
  hint,
  icon,
  sheen = true,
  className,
  children,
}: {
  label: string;
  value: React.ReactNode;
  /** Signed percentage/number change vs the previous period. */
  delta?: number;
  hint?: string;
  icon?: React.ReactNode;
  /** Amber→orange top sheen. On by default; disable for dense grids. */
  sheen?: boolean;
  className?: string;
  /** Optional slot (e.g. a sparkline) rendered below the value. */
  children?: React.ReactNode;
}) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const positive = hasDelta && delta! >= 0;

  return (
    <Card
      className={cn(
        "relative overflow-hidden shadow-warm-sm",
        sheen && "kpi-sheen",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
          {icon ? (
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
              {icon}
            </span>
          ) : null}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="font-heading text-3xl font-bold tracking-tight tabular-nums">
            {value}
          </span>
          {hasDelta ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 text-xs font-medium",
                positive ? "text-chart-5" : "text-destructive",
              )}
            >
              {positive ? (
                <ArrowUpRight className="size-3.5" />
              ) : (
                <ArrowDownRight className="size-3.5" />
              )}
              {Math.abs(delta!).toFixed(1)}%
            </span>
          ) : null}
        </div>

        {children}
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
