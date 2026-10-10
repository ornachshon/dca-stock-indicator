export type ChartRange = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y" | "5y" | "max";

export const CHART_RANGE_GROUPS: Array<{
  label: string;
  options: Array<{ id: ChartRange; label: string }>;
}> = [
  {
    label: "Days",
    options: [
      { id: "1d", label: "1D" },
      { id: "5d", label: "5D" },
    ],
  },
  {
    label: "Months",
    options: [
      { id: "1mo", label: "1M" },
      { id: "3mo", label: "3M" },
      { id: "6mo", label: "6M" },
    ],
  },
  {
    label: "Years",
    options: [
      { id: "1y", label: "1Y" },
      { id: "5y", label: "5Y" },
      { id: "max", label: "Max" },
    ],
  },
];

export const CHART_RANGE_CONFIG: Record<
  ChartRange,
  { yahooRange: string; interval: string }
> = {
  "1d": { yahooRange: "1d", interval: "5m" },
  "5d": { yahooRange: "5d", interval: "15m" },
  "1mo": { yahooRange: "1mo", interval: "1d" },
  "3mo": { yahooRange: "3mo", interval: "1d" },
  "6mo": { yahooRange: "6mo", interval: "1d" },
  "1y": { yahooRange: "1y", interval: "1wk" },
  "5y": { yahooRange: "5y", interval: "1mo" },
  max: { yahooRange: "max", interval: "3mo" },
};

export function parseChartRange(value: string | null): ChartRange {
  if (value && value in CHART_RANGE_CONFIG) {
    return value as ChartRange;
  }
  return "1y";
}

export function formatChartDate(timestamp: number, range: ChartRange): string {
  const date = new Date(timestamp * 1000);
  if (range === "1d" || range === "5d") {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (range === "5y" || range === "max") {
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
