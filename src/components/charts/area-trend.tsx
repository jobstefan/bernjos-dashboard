"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPeso } from "@/lib/utils/payroll";

export type ChartFormat = "peso" | "count" | "percent" | "minutes";

function makeFormatter(format: ChartFormat) {
  switch (format) {
    case "count":   return (v: number) => String(v);
    case "percent": return (v: number) => `${v}%`;
    case "minutes": return (v: number) => `${v} min`;
    default:        return formatPeso;
  }
}

function makeYAxisFormatter(format: ChartFormat) {
  switch (format) {
    case "count":   return (v: number) => String(v);
    case "percent": return (v: number) => `${v}%`;
    case "minutes": return (v: number) => `${v}m`;
    default:
      return (v: number) => {
        if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
        if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)}k`;
        return `₱${v}`;
      };
  }
}

export interface AreaSeries {
  key: string;
  label: string;
  color: string;
}

interface AreaTrendProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  series: AreaSeries[];
  xKey: string;
  format?: ChartFormat;
  stacked?: boolean;
  height?: number;
}

const reducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

export function AreaTrend({
  data,
  series,
  xKey,
  format = "peso",
  stacked = false,
  height = 220,
}: AreaTrendProps) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  );

  const tooltipFmt = makeFormatter(format);
  const yAxisFmt   = makeYAxisFormatter(format);

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={`var(--color-${s.key})`} stopOpacity={0.35} />
              <stop offset="95%" stopColor={`var(--color-${s.key})`} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={xKey}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickFormatter={yAxisFmt}
          width={52}
        />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(v) => tooltipFmt(Number(v))} />}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stackId={stacked ? "stack" : undefined}
            stroke={`var(--color-${s.key})`}
            fill={`url(#grad-${s.key})`}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reducedMotion}
          />
        ))}
      </AreaChart>
    </ChartContainer>
  );
}
