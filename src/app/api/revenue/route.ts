import { NextRequest, NextResponse } from "next/server";
import type { RevenuePayload, RevenuePoint } from "../../../lib/types";

type TimeseriesEntry = {
  asOfDate?: string;
  currencyCode?: string;
  reportedValue?: { raw?: number };
};

type TimeseriesResult = {
  meta?: { type?: string[] };
  annualTotalRevenue?: TimeseriesEntry[];
};

type TimeseriesResponse = {
  timeseries?: {
    result?: TimeseriesResult[];
  };
};

function formatYear(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return String(date.getFullYear());
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const tenYearsAgo = Math.floor(Date.now() / 1000) - 10 * 365 * 24 * 60 * 60;
    const url = new URL(
      `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`
    );
    url.searchParams.set("type", "annualTotalRevenue");
    url.searchParams.set("period1", String(tenYearsAgo));
    url.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch revenue data" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as TimeseriesResponse;
    const revenueEntries =
      data.timeseries?.result?.find((block) =>
        block.meta?.type?.includes("annualTotalRevenue")
      )?.annualTotalRevenue ?? [];

    const sorted = revenueEntries
      .filter(
        (entry) =>
          entry.asOfDate &&
          entry.reportedValue?.raw != null &&
          !Number.isNaN(entry.reportedValue.raw)
      )
      .sort((a, b) => a.asOfDate!.localeCompare(b.asOfDate!));

    if (sorted.length === 0) {
      return NextResponse.json(
        { error: `No revenue data found for ${symbol}` },
        { status: 404 }
      );
    }

    let currency = "USD";
    const points: RevenuePoint[] = sorted.map((entry, index) => {
      const revenue = entry.reportedValue!.raw!;
      if (entry.currencyCode) currency = entry.currencyCode;

      let growthPercent: number | null = null;
      if (index > 0) {
        const previous = sorted[index - 1].reportedValue!.raw!;
        growthPercent =
          Math.round(((revenue - previous) / previous) * 1000) / 10;
      }

      return {
        year: formatYear(entry.asOfDate!),
        revenue,
        growthPercent,
      };
    });

    const latest = points[points.length - 1];
    const payload: RevenuePayload = {
      symbol,
      currency,
      points,
      latestRevenue: latest.revenue,
      latestGrowthPercent: latest.growthPercent,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
