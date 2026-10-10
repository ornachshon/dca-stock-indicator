import { NextRequest, NextResponse } from "next/server";
import type { StockSuggestion } from "../../../lib/types";

type YahooSearchQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchange?: string;
  quoteType?: string;
};

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
    url.searchParams.set("q", q);
    url.searchParams.set("quotesCount", "8");
    url.searchParams.set("newsCount", "0");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to search stocks" },
        { status: 502 }
      );
    }

    const data = (await res.json()) as { quotes?: YahooSearchQuote[] };
    const results: StockSuggestion[] = (data.quotes ?? [])
      .filter(
        (quote) =>
          quote.symbol &&
          (quote.quoteType === "EQUITY" ||
            quote.quoteType === "ETF" ||
            quote.quoteType === "INDEX")
      )
      .map((quote) => ({
        symbol: quote.symbol!,
        name: quote.shortname || quote.longname || quote.symbol!,
        exchange: quote.exchange || "",
      }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Failed to search stocks" },
      { status: 500 }
    );
  }
}
