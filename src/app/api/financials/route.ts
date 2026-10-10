import { NextRequest, NextResponse } from "next/server";
import type { DebtCashPoint, FinancialsPayload } from "../../../lib/types";

type TimeseriesEntry = {
  asOfDate?: string;
  currencyCode?: string;
  reportedValue?: { raw?: number };
};

type TimeseriesResult = {
  meta?: { type?: string[] };
  quarterlyTotalDebt?: TimeseriesEntry[];
  quarterlyCashAndCashEquivalents?: TimeseriesEntry[];
};

type TimeseriesResponse = {
  timeseries?: {
    result?: TimeseriesResult[];
  };
};

function formatPeriod(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
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
    url.searchParams.set("type", "quarterlyTotalDebt,quarterlyCashAndCashEquivalents");
    url.searchParams.set("period1", "0");
    url.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch financial data" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as TimeseriesResponse;
    const results = data.timeseries?.result ?? [];

    let debtEntries: TimeseriesEntry[] = [];
    let cashEntries: TimeseriesEntry[] = [];

    for (const block of results) {
      const type = block.meta?.type?.[0];
      if (type === "quarterlyTotalDebt") {
        debtEntries = block.quarterlyTotalDebt ?? [];
      } else if (type === "quarterlyCashAndCashEquivalents") {
        cashEntries = block.quarterlyCashAndCashEquivalents ?? [];
      }
    }

    const debtByDate = new Map<string, number>();
    for (const entry of debtEntries) {
      const value = entry.reportedValue?.raw;
      if (entry.asOfDate && value != null && !Number.isNaN(value)) {
        debtByDate.set(entry.asOfDate, value);
      }
    }

    const cashByDate = new Map<string, number>();
    let currency = "USD";
    for (const entry of cashEntries) {
      const value = entry.reportedValue?.raw;
      if (entry.asOfDate && value != null && !Number.isNaN(value)) {
        cashByDate.set(entry.asOfDate, value);
        if (entry.currencyCode) currency = entry.currencyCode;
      }
    }

    const dates = [...new Set([...debtByDate.keys(), ...cashByDate.keys()])].sort();
    const points: DebtCashPoint[] = dates
      .map((date) => ({
        period: formatPeriod(date),
        cash: cashByDate.get(date) ?? 0,
        debt: debtByDate.get(date) ?? 0,
      }))
      .filter((point) => point.cash > 0 || point.debt > 0);

    if (points.length === 0) {
      return NextResponse.json(
        { error: `No debt or cash data found for ${symbol}` },
        { status: 404 }
      );
    }

    const latest = points[points.length - 1];
    const payload: FinancialsPayload = {
      symbol,
      currency,
      points,
      latestCash: latest.cash,
      latestDebt: latest.debt,
      netDebt: latest.debt - latest.cash,
      cashToDebtRatio:
        latest.debt > 0
          ? Math.round((latest.cash / latest.debt) * 1000) / 1000
          : null,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch financial data" },
      { status: 500 }
    );
  }
}
