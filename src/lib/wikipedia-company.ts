const USER_AGENT = "DCAStockIndicator/1.0 (stock analysis app)";

type WikipediaSearchResponse = {
  query?: { search?: Array<{ title: string }> };
};

type WikipediaPagePropsResponse = {
  query?: {
    pages?: Record<string, { pageprops?: { wikibase_item?: string } }>;
  };
};

type WikipediaSummary = {
  extract?: string;
  description?: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function getCompanyName(symbol: string) {
  const chart = await fetchJson<{
    chart?: { result?: Array<{ meta?: { shortName?: string } }> };
  }>(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`
  );
  return chart?.chart?.result?.[0]?.meta?.shortName ?? symbol;
}

async function findCompanyTitle(companyName: string) {
  const search = await fetchJson<WikipediaSearchResponse>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=${encodeURIComponent(companyName)}&srlimit=1`
  );
  return search?.query?.search?.[0]?.title ?? null;
}

export async function getCompanyWikipediaSummary(symbol: string) {
  const companyName = await getCompanyName(symbol);
  const title = await findCompanyTitle(companyName);
  if (!title) return null;

  const summary = await fetchJson<WikipediaSummary>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`
  );

  const text =
    summary?.extract ?? summary?.description ?? null;

  if (!text) return null;

  return { companyName, summary: text };
}
