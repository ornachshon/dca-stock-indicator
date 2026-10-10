export async function fetchPriceGrowth(
  symbol: string,
  period1Sec: number,
  period2Sec: number
) {
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`
  );
  url.searchParams.set("period1", String(period1Sec));
  url.searchParams.set("period2", String(period2Sec));
  url.searchParams.set("interval", "1mo");
  url.searchParams.set("includePrePost", "false");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 86400 },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    chart?: {
      result?: Array<{
        meta?: { regularMarketPrice?: number };
        indicators?: { quote?: Array<{ close?: Array<number | null> }> };
      }>;
    };
  };

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

  return Math.round(((endPrice - startPrice) / startPrice) * 1000) / 10;
}

export function growthSinceYear(startYear: number) {
  const period1 = Math.floor(Date.UTC(startYear, 0, 1) / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  return { period1, period2 };
}
