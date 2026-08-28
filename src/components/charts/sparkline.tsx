"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface SparklineProps {
  data: number[] | { v: number }[];
  color?: string;
  height?: number;
}

const reducedMotion =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

export function Sparkline({
  data,
  color = "var(--chart-1)",
  height = 36,
}: SparklineProps) {
  const normalized = data.map((d) =>
    typeof d === "number" ? { v: d } : d,
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={normalized} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill="url(#spark-grad)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={!reducedMotion}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
