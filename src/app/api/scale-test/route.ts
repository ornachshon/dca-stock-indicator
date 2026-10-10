import { NextRequest, NextResponse } from "next/server";
import type { ScaleTestPayload, ScaleTestPoint } from "../../../lib/types";

type TimeseriesEntry = {
  asOfDate?: string;
  currencyCode?: string;
  reportedValue?: { raw?: number };
};

type TimeseriesResult = {
  meta?: { type?: string[] };
  annualTotalRevenue?: TimeseriesEntry[];
  annualOperatingExpense?: TimeseriesEntry[];
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

function growthPercent(current: number, previous: number) {
  return Math.round(((current - previous) / previous) * 1000) / 10;
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
    url.searchParams.set("type", "annualTotalRevenue,annualOperatingExpense");
    url.searchParams.set("period1", String(tenYearsAgo));
    url.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch scale test data" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as TimeseriesResponse;
    const results = data.timeseries?.result ?? [];

    const revenueByDate = new Map<string, number>();
    const opexByDate = new Map<string, number>();
    let currency = "USD";

    for (const block of results) {
      const type = block.meta?.type?.[0];
      if (type === "annualTotalRevenue") {
        for (const entry of block.annualTotalRevenue ?? []) {
          const value = entry.reportedValue?.raw;
          if (entry.asOfDate && value != null && !Number.isNaN(value)) {
            revenueByDate.set(entry.asOfDate, value);
            if (entry.currencyCode) currency = entry.currencyCode;
          }
        }
      } else if (type === "annualOperatingExpense") {
        for (const entry of block.annualOperatingExpense ?? []) {
          const value = entry.reportedValue?.raw;
          if (entry.asOfDate && value != null && !Number.isNaN(value)) {
            opexByDate.set(entry.asOfDate, value);
            if (entry.currencyCode) currency = entry.currencyCode;
          }
        }
      }
    }

    const dates = [...revenueByDate.keys()]
      .filter((date) => opexByDate.has(date))
      .sort();

    if (dates.length === 0) {
      return NextResponse.json(
        { error: `No scale test data found for ${symbol}` },
        { status: 404 }
      );
    }

    const points: ScaleTestPoint[] = dates.map((date, index) => {
      const revenue = revenueByDate.get(date)!;
      const opex = opexByDate.get(date)!;

      let revenueGrowth: number | null = null;
      let opexGrowth: number | null = null;

      if (index > 0) {
        const prevDate = dates[index - 1];
        revenueGrowth = growthPercent(revenue, revenueByDate.get(prevDate)!);
        opexGrowth = growthPercent(opex, opexByDate.get(prevDate)!);
      }

      return {
        year: formatYear(date),
        revenueGrowth,
        opexGrowth,
      };
    });

    const growthPoints = points.filter(
      (point) => point.revenueGrowth != null && point.opexGrowth != null
    );

    if (growthPoints.length === 0) {
      return NextResponse.json(
        { error: `Not enough history for scale test on ${symbol}` },
        { status: 404 }
      );
    }

    const latest = growthPoints[growthPoints.length - 1];
    const payload: ScaleTestPayload = {
      symbol,
      currency,
      points: growthPoints,
      latestRevenueGrowth: latest.revenueGrowth,
      latestOpexGrowth: latest.opexGrowth,
      scaleTestPassed:
        latest.revenueGrowth != null && latest.opexGrowth != null
          ? latest.revenueGrowth >= latest.opexGrowth
          : null,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch scale test data" },
      { status: 500 }
    );
  }
}
