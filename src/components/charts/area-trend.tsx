"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export type ChartFormat = "peso" | "count" | "percent" | "minutes";

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
  /** "date" formats "MM-DD" ticks as "Aug 31" with rotated labels. */
  xFormat?: "date";
}

const reducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

const fmtMMDD = (val: string) => {
  const [m, d] = val.split("-").map(Number);
  return new Date(2000, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export function AreaTrend({
  data,
  series,
  xKey,
  format = "peso",
  stacked = false,
  height = 220,
  xFormat,
}: AreaTrendProps) {
  const tickFormatter = xFormat === "date" ? fmtMMDD : undefined;
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  );

  const yAxisFmt = makeYAxisFormatter(format);

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
          tick={{ fontSize: 11, angle: tickFormatter ? -35 : 0, textAnchor: tickFormatter ? "end" : "middle" }}
          tickMargin={8}
          height={tickFormatter ? 45 : undefined}
          tickFormatter={tickFormatter}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
          tickFormatter={yAxisFmt}
          width={52}
        />
        <ChartTooltip content={<ChartTooltipContent className="min-w-44" />} />
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
