import { NextRequest, NextResponse } from "next/server";
import type { CultureMissionPayload } from "../../../lib/types";
import { getCompanyWikipediaSummary } from "../../../lib/wikipedia-company";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Symbol is required" }, { status: 400 });
  }

  try {
    const profile = await getCompanyWikipediaSummary(symbol);

    if (!profile) {
      return NextResponse.json(
        { error: `No culture or mission profile found for ${symbol}` },
        { status: 404 }
      );
    }

    const payload: CultureMissionPayload = {
      symbol,
      companyName: profile.companyName,
      summary: profile.summary,
    };

    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch culture and mission data" },
      { status: 500 }
    );
  }
}
