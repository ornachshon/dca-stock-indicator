import { NextRequest, NextResponse } from "next/server";
import type { MarginPoint, MarginsPayload } from "../../../lib/types";

type TimeseriesEntry = {
  asOfDate?: string;
  currencyCode?: string;
  reportedValue?: { raw?: number };
};

type TimeseriesResult = {
  meta?: { type?: string[] };
  annualTotalRevenue?: TimeseriesEntry[];
  annualNetIncomeCommonStockholders?: TimeseriesEntry[];
  annualOperatingIncome?: TimeseriesEntry[];
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
    url.searchParams.set(
      "type",
      "annualTotalRevenue,annualNetIncomeCommonStockholders,annualOperatingIncome"
    );
    url.searchParams.set("period1", String(tenYearsAgo));
    url.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch margin data" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as TimeseriesResponse;
    const results = data.timeseries?.result ?? [];

    const revenueByDate = new Map<string, number>();
    const incomeByDate = new Map<string, number>();
    const operatingIncomeByDate = new Map<string, number>();
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
      } else if (type === "annualNetIncomeCommonStockholders") {
        for (const entry of block.annualNetIncomeCommonStockholders ?? []) {
          const value = entry.reportedValue?.raw;
          if (entry.asOfDate && value != null && !Number.isNaN(value)) {
            incomeByDate.set(entry.asOfDate, value);
            if (entry.currencyCode) currency = entry.currencyCode;
          }
        }
      } else if (type === "annualOperatingIncome") {
        for (const entry of block.annualOperatingIncome ?? []) {
          const value = entry.reportedValue?.raw;
          if (entry.asOfDate && value != null && !Number.isNaN(value)) {
            operatingIncomeByDate.set(entry.asOfDate, value);
            if (entry.currencyCode) currency = entry.currencyCode;
          }
        }
      }
    }

    const dates = [...revenueByDate.keys()]
      .filter((date) => incomeByDate.has(date))
      .sort();

    const points: MarginPoint[] = dates
      .map((date) => {
        const revenue = revenueByDate.get(date)!;
        const amount = incomeByDate.get(date)!;
        const percent = Math.round((amount / revenue) * 1000) / 10;
        const operatingAmount = operatingIncomeByDate.get(date);
        const operatingPercent =
          operatingAmount != null && revenue !== 0
            ? Math.round((operatingAmount / revenue) * 1000) / 10
            : null;
        return {
          year: formatYear(date),
          amount,
          percent,
          operatingPercent,
        };
      })
      .filter((point) => point.amount !== 0 || point.percent !== 0);

    if (points.length === 0) {
      return NextResponse.json(
        { error: `No margin data found for ${symbol}` },
        { status: 404 }
      );
    }

    const latest = points[points.length - 1];
    const operatingDates = [...revenueByDate.keys()]
      .filter((date) => operatingIncomeByDate.has(date))
      .sort();
    const latestOperatingDate = operatingDates[operatingDates.length - 1];
    const latestOperatingAmount = latestOperatingDate
      ? operatingIncomeByDate.get(latestOperatingDate)!
      : 0;
    const latestOperatingRevenue = latestOperatingDate
      ? revenueByDate.get(latestOperatingDate)!
      : 0;
    const latestOperatingPercent =
      latestOperatingRevenue > 0
        ? Math.round((latestOperatingAmount / latestOperatingRevenue) * 1000) / 10
        : 0;

    const payload: MarginsPayload = {
      symbol,
      currency,
      points,
      latestAmount: latest.amount,
      latestPercent: latest.percent,
      latestOperatingAmount,
      latestOperatingPercent,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch margin data" },
      { status: 500 }
    );
  }
}
