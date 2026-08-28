"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPeso } from "@/lib/utils/payroll";
import type { ChartFormat } from "./area-trend";

function makeFormatter(format: ChartFormat) {
  switch (format) {
    case "count":   return (v: number) => String(v);
    case "percent": return (v: number) => `${v}%`;
    case "minutes": return (v: number) => `${v} min`;
    default:        return formatPeso;
  }
}

export interface BarSeriesItem {
  key: string;
  label: string;
  color: string;
}

interface BarSeriesProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  series: BarSeriesItem[];
  xKey: string;
  layout?: "horizontal" | "vertical";
  format?: ChartFormat;
  stacked?: boolean;
  height?: number;
}

const reducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

export function BarSeries({
  data,
  series,
  xKey,
  layout = "horizontal",
  format = "peso",
  stacked = false,
  height = 220,
}: BarSeriesProps) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.key, { label: s.label, color: s.color }]),
  );

  const tooltipFmt = makeFormatter(format);
  const stackId    = stacked ? "stack" : undefined;

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <BarChart data={data} layout={layout} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={layout === "vertical"}
          horizontal={layout === "horizontal"}
        />
        {layout === "horizontal" ? (
          <>
            <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickMargin={8} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              allowDecimals={format !== "count"}
              tickFormatter={(v: number) => {
                if (format === "peso") {
                  if (v >= 1_000_000) return `₱${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `₱${(v / 1_000).toFixed(0)}k`;
                }
                return String(v);
              }}
              width={48}
            />
          </>
        ) : (
          <>
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} tickFormatter={String} />
            <YAxis type="category" dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={100} />
          </>
        )}
        <ChartTooltip
          content={<ChartTooltipContent formatter={(v) => tooltipFmt(Number(v))} />}
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId={stackId}
            fill={`var(--color-${s.key})`}
            radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            isAnimationActive={!reducedMotion}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
