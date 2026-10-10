import { NextRequest, NextResponse } from "next/server";
import type { ShortInterestPayload } from "../../../lib/types";
import { getYahooCrumbSession } from "../../../lib/yahoo-crumb";

export const runtime = "nodejs";

type YahooRawValue = {
  raw?: number;
  fmt?: string;
};

type DefaultKeyStatistics = {
  shortPercentOfFloat?: YahooRawValue;
  sharesPercentSharesOut?: YahooRawValue;
  shortRatio?: YahooRawValue;
  sharesShort?: YahooRawValue;
  heldPercentInstitutions?: YahooRawValue;
};

type QuoteSummaryResponse = {
  quoteSummary?: {
    result?: Array<{
      defaultKeyStatistics?: DefaultKeyStatistics;
    }>;
  };
};

function readRawValue(value?: YahooRawValue) {
  if (value?.raw == null || Number.isNaN(value.raw)) return null;
  return value.raw;
}

function toPercent(value: number) {
  return Math.round(value * 10000) / 100;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const { cookie, crumb } = await getYahooCrumbSession();
    const url = new URL(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`
    );
    url.searchParams.set("modules", "defaultKeyStatistics");
    url.searchParams.set("crumb", crumb);

    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Mozilla/5.0", Cookie: cookie },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch short interest data" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as QuoteSummaryResponse;
    const stats = data.quoteSummary?.result?.[0]?.defaultKeyStatistics;
    const shortRaw =
      readRawValue(stats?.shortPercentOfFloat) ??
      readRawValue(stats?.sharesPercentSharesOut);
    const institutionalRaw = readRawValue(stats?.heldPercentInstitutions);

    if (shortRaw == null && institutionalRaw == null) {
      return NextResponse.json(
        { error: `No market stats found for ${symbol}` },
        { status: 404 }
      );
    }

    const payload: ShortInterestPayload = {
      symbol,
      shortPercent: shortRaw != null ? toPercent(shortRaw) : null,
      shortRatio: readRawValue(stats?.shortRatio),
      sharesShort: readRawValue(stats?.sharesShort),
      institutionalPercent:
        institutionalRaw != null ? toPercent(institutionalRaw) : null,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch short interest data" },
      { status: 500 }
    );
  }
}
