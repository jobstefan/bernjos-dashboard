/** Semantic color mapping — all reference the warm CSS chart tokens. */

export const CHART_TOKENS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const SEMANTIC_COLORS = {
  net: "var(--chart-1)",
  gross: "var(--chart-2)",
  deductions: "var(--chart-3)",
  gold: "var(--chart-4)",
  savings: "var(--chart-5)",
} as const;
