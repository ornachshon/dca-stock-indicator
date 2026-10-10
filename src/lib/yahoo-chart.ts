import { CHART_RANGE_CONFIG, type ChartRange } from "./chart-range";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: {
        shortName?: string;
        symbol?: string;
        currency?: string;
        regularMarketPrice?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
          high?: Array<number | null>;
        }>;
      };
    }>;
    error?: unknown;
  };
};

export type ParsedYahooChart = {
  timestamps: number[];
  closes: Array<number | null>;
  highs: Array<number | null>;
  meta?: {
    shortName?: string;
    symbol?: string;
    currency?: string;
    regularMarketPrice?: number;
  };
};

export async function fetchYahooChart(
  symbol: string,
  range: ChartRange
): Promise<ParsedYahooChart | null> {
  const config = CHART_RANGE_CONFIG[range];
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  );
  url.searchParams.set("range", config.yahooRange);
  url.searchParams.set("interval", config.interval);
  url.searchParams.set("includePrePost", "false");

  const res = await fetch(url.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart?.result?.[0];
  if (!result?.timestamp?.length) return null;

  const quote = result.indicators?.quote?.[0];
  return {
    timestamps: result.timestamp,
    closes: quote?.close ?? [],
    highs: quote?.high ?? [],
    meta: result.meta,
  };
}

export function computePeriodHigh(parsed: ParsedYahooChart): number {
  let periodHigh = 0;
  for (let i = 0; i < parsed.timestamps.length; i++) {
    const high = parsed.highs[i] ?? parsed.closes[i];
    if (high != null && !Number.isNaN(high) && high > periodHigh) {
      periodHigh = high;
    }
  }
  return periodHigh;
}
