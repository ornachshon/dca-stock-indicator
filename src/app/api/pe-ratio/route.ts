import { NextRequest, NextResponse } from "next/server";
import { formatChartDate, parseChartRange } from "../../../lib/chart-range";
import { getYahooCrumbSession } from "../../../lib/yahoo-crumb";
import { fetchYahooChart } from "../../../lib/yahoo-chart";
import type { PeRatioPayload, PeRatioPoint } from "../../../lib/types";

type QuoteSummaryResponse = {
  quoteSummary?: {
    result?: Array<{
      defaultKeyStatistics?: {
        trailingEps?: { raw?: number };
      };
      summaryDetail?: {
        trailingPE?: { raw?: number };
      };
    }>;
  };
};

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();
  const range = parseChartRange(request.nextUrl.searchParams.get("range"));

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const [priceChart, crumbSession] = await Promise.all([
      fetchYahooChart(symbol, range),
      getYahooCrumbSession().catch(() => null),
    ]);

    if (!priceChart) {
      return NextResponse.json(
        { error: "Failed to fetch P/E ratio data" },
        { status: 502 }
      );
    }

    let trailingEps: number | null = null;
    let trailingPe: number | null = null;

    if (crumbSession) {
      const summaryUrl = new URL(
        `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`
      );
      summaryUrl.searchParams.set("modules", "defaultKeyStatistics,summaryDetail");
      summaryUrl.searchParams.set("crumb", crumbSession.crumb);

      const summaryRes = await fetch(summaryUrl.toString(), {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Cookie: crumbSession.cookie,
        },
        next: { revalidate: 86400 },
      });

      if (summaryRes.ok) {
        const summaryData = (await summaryRes.json()) as QuoteSummaryResponse;
        const summary = summaryData.quoteSummary?.result?.[0];
        const epsRaw = summary?.defaultKeyStatistics?.trailingEps?.raw;
        const peRaw = summary?.summaryDetail?.trailingPE?.raw;

        if (epsRaw != null && !Number.isNaN(epsRaw) && epsRaw > 0) {
          trailingEps = epsRaw;
        }
        if (peRaw != null && !Number.isNaN(peRaw) && peRaw > 0) {
          trailingPe = Math.round(peRaw * 100) / 100;
        }
      }
    }

    if (trailingEps == null || trailingEps <= 0) {
      return NextResponse.json(
        { error: `No P/E ratio data found for ${symbol}` },
        { status: 404 }
      );
    }

    const points: PeRatioPoint[] = [];

    for (let i = 0; i < priceChart.timestamps.length; i++) {
      const close = priceChart.closes[i];
      if (close == null || Number.isNaN(close) || close <= 0) continue;

      points.push({
        date: formatChartDate(priceChart.timestamps[i], range),
        pe: Math.round((close / trailingEps) * 100) / 100,
      });
    }

    if (points.length === 0) {
      return NextResponse.json(
        { error: `No P/E ratio data found for ${symbol}` },
        { status: 404 }
      );
    }

    const latestPe = points[points.length - 1].pe;
    const payload: PeRatioPayload = {
      symbol,
      points,
      latestPe,
      trailingPe: trailingPe ?? latestPe,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch P/E ratio data" },
      { status: 500 }
    );
  }
}
