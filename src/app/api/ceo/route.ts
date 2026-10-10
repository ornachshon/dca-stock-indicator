import { NextRequest, NextResponse } from "next/server";
import type { CeoPayload } from "../../../lib/types";
import { fetchPriceGrowth, growthSinceYear } from "../../../lib/yahoo-growth";

const USER_AGENT = "DCAStockIndicator/1.0 (stock analysis app)";
const SP500_SYMBOL = "^GSPC";

type WikidataEntity = {
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  claims?: Record<
    string,
    Array<{
      mainsnak?: {
        datavalue?: { value?: { id?: string } };
      };
      qualifiers?: Record<
        string,
        Array<{ datavalue?: { value?: { time?: string } } }>
      >;
    }>
  >;
};

type WikipediaSearchResponse = {
  query?: {
    search?: Array<{ title: string }>;
  };
};

type WikipediaPagePropsResponse = {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        pageprops?: { wikibase_item?: string };
      }
    >;
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

async function findCompanyQid(companyName: string) {
  const search = await fetchJson<WikipediaSearchResponse>(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=${encodeURIComponent(companyName)}&srlimit=1`
  );
  const title = search?.query?.search?.[0]?.title;
  if (!title) return null;

  const props = await fetchJson<WikipediaPagePropsResponse>(
    `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&format=json&titles=${encodeURIComponent(title)}`
  );
  const page = Object.values(props?.query?.pages ?? {})[0];
  return page?.pageprops?.wikibase_item ?? null;
}

function parseWikidataDate(time?: string) {
  if (!time) return null;
  const match = time.match(/^([+-]?\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month, day));
}

function getCurrentCeoQid(entity: WikidataEntity) {
  const claims = entity.claims?.P169 ?? [];
  const now = Date.now();
  let best: { qid: string; startMs: number } | null = null;

  for (const claim of claims) {
    const qid = claim.mainsnak?.datavalue?.value?.id;
    if (!qid) continue;

    const startDate = parseWikidataDate(
      claim.qualifiers?.P580?.[0]?.datavalue?.value?.time
    );
    const endDate = parseWikidataDate(
      claim.qualifiers?.P582?.[0]?.datavalue?.value?.time
    );

    if (startDate && startDate.getTime() > now) continue;
    if (endDate && endDate.getTime() <= now) continue;

    const startMs = startDate?.getTime() ?? 0;
    if (!best || startMs >= best.startMs) {
      best = { qid, startMs };
    }
  }

  return best
    ? {
        qid: best.qid,
        startYear:
          best.startMs > 0 ? new Date(best.startMs).getUTCFullYear() : 0,
      }
    : null;
}

async function getPersonDetails(qid: string) {
  const entityData = await fetchJson<{ entities?: Record<string, WikidataEntity> }>(
    `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`
  );
  const entity = entityData?.entities?.[qid];
  if (!entity) return null;

  const name = entity.labels?.en?.value;
  if (!name) return null;

  const wikipediaTitle = encodeURIComponent(name.replace(/ /g, "_"));
  const summary = await fetchJson<WikipediaSummary>(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${wikipediaTitle}`
  );

  const description =
    summary?.extract ??
    summary?.description ??
    entity.descriptions?.en?.value ??
    "No public biography available.";

  return { name, description };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const companyName = await getCompanyName(symbol);
    const companyQid = await findCompanyQid(companyName);

    if (!companyQid) {
      return NextResponse.json(
        { error: `Could not find company profile for ${symbol}` },
        { status: 404 }
      );
    }

    const companyData = await fetchJson<{ entities?: Record<string, WikidataEntity> }>(
      `https://www.wikidata.org/wiki/Special:EntityData/${companyQid}.json`
    );
    const companyEntity = companyData?.entities?.[companyQid];
    if (!companyEntity) {
      return NextResponse.json(
        { error: `Could not load company profile for ${symbol}` },
        { status: 404 }
      );
    }

    const currentCeo = getCurrentCeoQid(companyEntity);
    if (!currentCeo) {
      return NextResponse.json(
        { error: `No CEO information found for ${companyName}` },
        { status: 404 }
      );
    }

    const person = await getPersonDetails(currentCeo.qid);
    if (!person) {
      return NextResponse.json(
        { error: `Could not load CEO profile for ${companyName}` },
        { status: 404 }
      );
    }

    let tenureYears: number | null = null;
    let tenureStockGrowthPercent: number | null = null;
    let tenureSp500GrowthPercent: number | null = null;
    let tenureOutperformancePercent: number | null = null;

    if (currentCeo.startYear > 0) {
      tenureYears = Math.max(0, new Date().getUTCFullYear() - currentCeo.startYear);
      const { period1, period2 } = growthSinceYear(currentCeo.startYear);
      const [stockGrowth, sp500Growth] = await Promise.all([
        fetchPriceGrowth(symbol, period1, period2),
        fetchPriceGrowth(SP500_SYMBOL, period1, period2),
      ]);

      if (stockGrowth != null && sp500Growth != null) {
        tenureStockGrowthPercent = stockGrowth;
        tenureSp500GrowthPercent = sp500Growth;
        tenureOutperformancePercent =
          Math.round((stockGrowth - sp500Growth) * 10) / 10;
      }
    }

    const payload: CeoPayload = {
      symbol,
      companyName,
      name: person.name,
      title: "Chief Executive Officer",
      description: person.description,
      since: currentCeo.startYear > 0 ? String(currentCeo.startYear) : undefined,
      tenureYears,
      tenureStockGrowthPercent,
      tenureSp500GrowthPercent,
      tenureOutperformancePercent,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch CEO information" },
      { status: 500 }
    );
  }
}
