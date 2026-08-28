"use client";

import { Pie, PieChart, Cell } from "recharts";
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

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutProps {
  data: DonutSlice[];
  centerLabel?: string;
  centerValue?: string;
  format?: ChartFormat;
  height?: number;
}

const reducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

export function Donut({
  data,
  centerLabel,
  centerValue,
  format = "peso",
  height = 220,
}: DonutProps) {
  const config: ChartConfig = Object.fromEntries(
    data.map((d) => [d.key, { label: d.label, color: d.color }]),
  );

  const tooltipFmt = makeFormatter(format);

  return (
    <ChartContainer config={config} className="w-full" style={{ height }}>
      <PieChart>
        <ChartTooltip
          content={<ChartTooltipContent formatter={(v) => tooltipFmt(Number(v))} />}
        />
        <Pie
          data={data}
          dataKey="value"
          nameKey="key"
          cx="50%"
          cy="50%"
          innerRadius="58%"
          outerRadius="80%"
          paddingAngle={3}
          isAnimationActive={!reducedMotion}
        >
          {data.map((slice) => (
            <Cell key={slice.key} fill={`var(--color-${slice.key})`} />
          ))}
        </Pie>
        {(centerLabel || centerValue) && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
            {centerValue && (
              <tspan
                x="50%"
                dy="-0.3em"
                className="fill-foreground font-heading text-base font-bold"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {centerValue}
              </tspan>
            )}
            {centerLabel && (
              <tspan x="50%" dy="1.4em" className="fill-muted-foreground" style={{ fontSize: 11 }}>
                {centerLabel}
              </tspan>
            )}
          </text>
        )}
      </PieChart>
    </ChartContainer>
  );
}
