import { NextRequest, NextResponse } from "next/server";
import type { RevenuePayload, RevenuePoint, RevenueSeries } from "../../../lib/types";

type TimeseriesEntry = {
  asOfDate?: string;
  currencyCode?: string;
  reportedValue?: { raw?: number };
};

type TimeseriesResult = {
  meta?: { type?: string[] };
  annualTotalRevenue?: TimeseriesEntry[];
  quarterlyTotalRevenue?: TimeseriesEntry[];
};

type TimeseriesResponse = {
  timeseries?: {
    result?: TimeseriesResult[];
  };
};

function formatLabel(dateStr: string, period: "annual" | "quarterly") {
  const date = new Date(`${dateStr}T00:00:00`);
  if (period === "annual") return String(date.getFullYear());
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function toSeries(entries: TimeseriesEntry[], period: "annual" | "quarterly"): RevenueSeries {
  const sorted = entries
    .filter(
      (entry) =>
        entry.asOfDate &&
        entry.reportedValue?.raw != null &&
        !Number.isNaN(entry.reportedValue.raw)
    )
    .sort((a, b) => a.asOfDate!.localeCompare(b.asOfDate!));

  const points: RevenuePoint[] = sorted.map((entry, index) => {
    const revenue = entry.reportedValue!.raw!;
    let growthPercent: number | null = null;
    if (index > 0) {
      const previous = sorted[index - 1].reportedValue!.raw!;
      if (previous !== 0) {
        growthPercent = Math.round(((revenue - previous) / previous) * 1000) / 10;
      }
    }

    return {
      year: formatLabel(entry.asOfDate!, period),
      revenue,
      growthPercent,
    };
  });

  const latest = points[points.length - 1];
  return {
    points,
    latestRevenue: latest?.revenue ?? 0,
    latestGrowthPercent: latest?.growthPercent ?? null,
  };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const url = new URL(
      `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`
    );
    url.searchParams.set("type", "annualTotalRevenue,quarterlyTotalRevenue");
    url.searchParams.set("period1", "0");
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
    const results = data.timeseries?.result ?? [];
    const annualEntries =
      results.find((block) => block.meta?.type?.includes("annualTotalRevenue"))
        ?.annualTotalRevenue ?? [];
    const quarterlyEntries =
      results.find((block) => block.meta?.type?.includes("quarterlyTotalRevenue"))
        ?.quarterlyTotalRevenue ?? [];

    const annual = toSeries(annualEntries, "annual");
    const quarterly = toSeries(quarterlyEntries, "quarterly");

    if (annual.points.length === 0 && quarterly.points.length === 0) {
      return NextResponse.json(
        { error: `No revenue data found for ${symbol}` },
        { status: 404 }
      );
    }

    const currency =
      [...annualEntries, ...quarterlyEntries].find((entry) => entry.currencyCode)
        ?.currencyCode ?? "USD";

    const payload: RevenuePayload = {
      symbol,
      currency,
      points: annual.points,
      latestRevenue: annual.points.length > 0 ? annual.latestRevenue : quarterly.latestRevenue,
      latestGrowthPercent:
        annual.points.length > 0 ? annual.latestGrowthPercent : quarterly.latestGrowthPercent,
      quarterly,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
