import { NextRequest, NextResponse } from "next/server";
import { formatChartDate, parseChartRange, type ChartRange } from "../../../lib/chart-range";
import { computePeriodHigh, fetchYahooChart } from "../../../lib/yahoo-chart";
import type { ChartPayload, PricePoint, StockStatus } from "../../../lib/types";

const DOUBLE_DOWN_DROP = 0.2;
const STATUS_RANGE: ChartRange = "1y";

function buildPricePoints(
  parsed: Awaited<ReturnType<typeof fetchYahooChart>> & object,
  range: ChartRange,
  doubleDownPrice: number
): PricePoint[] {
  const prices: PricePoint[] = [];

  for (let i = 0; i < parsed.timestamps.length; i++) {
    const close = parsed.closes[i];
    if (close == null || Number.isNaN(close)) continue;

    const roundedClose = Math.round(close * 100) / 100;
    prices.push({
      date: formatChartDate(parsed.timestamps[i], range),
      close: roundedClose,
      doubleDown: roundedClose <= doubleDownPrice,
    });
  }

  return prices;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  const range = parseChartRange(request.nextUrl.searchParams.get("range"));

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const statusChart = await fetchYahooChart(symbol, STATUS_RANGE);
    if (!statusChart) {
      return NextResponse.json(
        { error: `Could not find stock "${symbol}". Pick a suggestion from the list.` },
        { status: 502 }
      );
    }

    const displayData =
      range === STATUS_RANGE
        ? statusChart
        : (await fetchYahooChart(symbol, range)) ?? statusChart;

    const yearHighRaw = computePeriodHigh(statusChart);
    if (yearHighRaw <= 0) {
      return NextResponse.json(
        { error: `No price data found for ${symbol}` },
        { status: 404 }
      );
    }

    const doubleDownPrice = Math.round(yearHighRaw * (1 - DOUBLE_DOWN_DROP) * 100) / 100;
    const yearHigh = Math.round(yearHighRaw * 100) / 100;
    const prices = buildPricePoints(displayData, range, doubleDownPrice);

    if (prices.length === 0) {
      return NextResponse.json(
        { error: `No price data found for ${symbol}` },
        { status: 404 }
      );
    }

    const currentPrice =
      statusChart.meta?.regularMarketPrice != null
        ? Math.round(statusChart.meta.regularMarketPrice * 100) / 100
        : prices[prices.length - 1]?.close;

    if (currentPrice == null) {
      return NextResponse.json(
        { error: `No price data found for ${symbol}` },
        { status: 404 }
      );
    }

    const dropFromHigh = (yearHigh - currentPrice) / yearHigh;
    const status: StockStatus =
      dropFromHigh >= DOUBLE_DOWN_DROP ? "double_down" : "normal";

    let sector: string | undefined;
    let industry: string | undefined;
    try {
      const searchUrl = new URL("https://query1.finance.yahoo.com/v1/finance/search");
      searchUrl.searchParams.set("q", symbol);
      searchUrl.searchParams.set("quotesCount", "1");
      const searchRes = await fetch(searchUrl.toString(), {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 86400 },
      });
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as {
          quotes?: Array<{ sector?: string; industry?: string }>;
        };
        sector = searchData.quotes?.[0]?.sector;
        industry = searchData.quotes?.[0]?.industry;
      }
    } catch {
      // optional metadata
    }

    const payload: ChartPayload = {
      symbol: statusChart.meta?.symbol || symbol,
      name: statusChart.meta?.shortName || symbol,
      currency: statusChart.meta?.currency || "USD",
      sector,
      industry,
      prices,
      yearHigh,
      doubleDownPrice,
      currentPrice,
      dropPercent: Math.round(dropFromHigh * 1000) / 10,
      status,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch stock prices" },
      { status: 500 }
    );
  }
}
