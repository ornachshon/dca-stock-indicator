import { NextRequest, NextResponse } from "next/server";
import type { BenchmarkComparisonPayload } from "../../../lib/types";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

const SP500_SYMBOL = "^GSPC";

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

async function fetchFiveYearGrowth(symbol: string) {
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  );
  url.searchParams.set("range", "5y");
  url.searchParams.set("interval", "1mo");
  url.searchParams.set("includePrePost", "false");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as YahooChartResponse;
  const result = data.chart?.result?.[0];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  let startPrice: number | null = null;
  for (const close of closes) {
    if (close != null && !Number.isNaN(close) && close > 0) {
      startPrice = close;
      break;
    }
  }

  let endPrice = result?.meta?.regularMarketPrice ?? null;
  if (endPrice == null || Number.isNaN(endPrice)) {
    for (let i = closes.length - 1; i >= 0; i--) {
      const close = closes[i];
      if (close != null && !Number.isNaN(close)) {
        endPrice = close;
        break;
      }
    }
  }

  if (startPrice == null || endPrice == null || startPrice <= 0) {
    return null;
  }

  return roundPercent(((endPrice - startPrice) / startPrice) * 100);
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const [stockGrowthPercent, sp500GrowthPercent] = await Promise.all([
      fetchFiveYearGrowth(symbol),
      fetchFiveYearGrowth(SP500_SYMBOL),
    ]);

    if (stockGrowthPercent == null || sp500GrowthPercent == null) {
      return NextResponse.json(
        { error: `No 5-year benchmark data found for ${symbol}` },
        { status: 404 }
      );
    }

    const outperformancePercent = roundPercent(
      stockGrowthPercent - sp500GrowthPercent
    );

    const payload: BenchmarkComparisonPayload = {
      symbol,
      stockGrowthPercent,
      sp500GrowthPercent,
      outperformancePercent,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch benchmark comparison data" },
      { status: 500 }
    );
  }
}
