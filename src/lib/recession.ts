import type {
  ChartPayload,
  FinancialsPayload,
  MarginsPayload,
  RevenuePayload,
} from "./types";
import type { MoatSignal, MoatSignalStatus } from "./moat";

export type RecessionRating = "Recession resilient" | "Mixed" | "Cyclical";

export type RecessionAnalysis = {
  rating: RecessionRating;
  isRecessionProof: boolean;
  summary: string;
  signals: MoatSignal[];
};

export type RecessionProofScore = {
  score: number;
  maxScore: 5;
  rating: RecessionRating;
  explanation: string;
  signals: MoatSignal[];
};

const DEFENSIVE_SECTORS = new Set([
  "consumer defensive",
  "consumer staples",
  "healthcare",
  "health care",
  "utilities",
]);

const CYCLICAL_SECTORS = new Set([
  "technology",
  "consumer cyclical",
  "industrials",
  "financial services",
  "financial",
  "basic materials",
  "communication services",
  "real estate",
]);

function sectorSignal(sector?: string, industry?: string): MoatSignal {
  const normalized = (sector ?? industry ?? "unknown").toLowerCase();

  if (DEFENSIVE_SECTORS.has(normalized)) {
    return {
      label: "Sector",
      status: "strong",
      detail: `${sector ?? industry} is a defensive sector that often holds up better in recessions.`,
    };
  }
  if (CYCLICAL_SECTORS.has(normalized)) {
    return {
      label: "Sector",
      status: "weak",
      detail: `${sector ?? industry} is more cyclical and tends to feel recessions more sharply.`,
    };
  }
  return {
    label: "Sector",
    status: "moderate",
    detail: `${sector ?? industry ?? "This sector"} has a mixed recession track record.`,
  };
}

function revenueStabilitySignal(revenue: RevenuePayload): MoatSignal {
  const growthYears = revenue.points.filter((p) => p.growthPercent != null);
  const negativeYears = growthYears.filter(
    (p) => (p.growthPercent ?? 0) < 0
  ).length;

  if (negativeYears === 0) {
    return {
      label: "Revenue stability",
      status: "strong",
      detail: "Revenue has not declined year over year in the recent period shown.",
    };
  }
  if (negativeYears === 1) {
    return {
      label: "Revenue stability",
      status: "moderate",
      detail: "Revenue dipped in one recent year, showing some sensitivity to slowdowns.",
    };
  }
  return {
    label: "Revenue stability",
    status: "weak",
    detail: `Revenue declined in ${negativeYears} recent years, a sign of cyclical demand.`,
  };
}

function balanceSheetSignal(financials: FinancialsPayload): MoatSignal {
  const ratio =
    financials.cashToDebtRatio ??
    (financials.latestDebt > 0
      ? financials.latestCash / financials.latestDebt
      : null);

  if (ratio != null && ratio >= 1) {
    return {
      label: "Balance sheet",
      status: "strong",
      detail: "Cash exceeds debt, giving the company room to navigate a downturn.",
    };
  }
  if (ratio != null && ratio >= 0.5) {
    return {
      label: "Balance sheet",
      status: "moderate",
      detail: "Cash and debt are balanced, offering moderate recession protection.",
    };
  }
  return {
    label: "Balance sheet",
    status: "weak",
    detail: "Higher leverage can make recessions harder if cash flow slows.",
  };
}

function marginStabilitySignal(margins: MarginsPayload): MoatSignal | null {
  if (margins.points.length < 2) return null;
  const change =
    margins.points[margins.points.length - 1].percent - margins.points[0].percent;

  if (change >= -1) {
    return {
      label: "Margin stability",
      status: "strong",
      detail: "Margins have held up well, which helps in weaker economic periods.",
    };
  }
  if (change >= -4) {
    return {
      label: "Margin stability",
      status: "moderate",
      detail: "Margins have softened somewhat but not collapsed.",
    };
  }
  return {
    label: "Margin stability",
    status: "weak",
    detail: "Falling margins suggest the business feels pressure when demand slows.",
  };
}

function priceVolatilitySignal(chart: ChartPayload): MoatSignal | null {
  if (chart.prices.length < 3) return null;

  const returns: number[] = [];
  for (let i = 1; i < chart.prices.length; i++) {
    const prev = chart.prices[i - 1].close;
    const curr = chart.prices[i].close;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  if (returns.length === 0) return null;

  const variance =
    returns.reduce((sum, value) => sum + value * value, 0) / returns.length;
  const weeklyVol = Math.sqrt(variance) * 100;

  if (weeklyVol <= 3) {
    return {
      label: "Price volatility",
      status: "strong",
      detail: `Weekly price swings are relatively low (${weeklyVol.toFixed(1)}%), typical of more defensive names.`,
    };
  }
  if (weeklyVol <= 5.5) {
    return {
      label: "Price volatility",
      status: "moderate",
      detail: `Price volatility is moderate (${weeklyVol.toFixed(1)}% weekly).`,
    };
  }
  return {
    label: "Price volatility",
    status: "weak",
    detail: `Price swings are high (${weeklyVol.toFixed(1)}% weekly), which is common in more cyclical stocks.`,
  };
}

function scoreSignals(signals: MoatSignal[]) {
  if (signals.length === 0) return 0;
  const total = signals.reduce((sum, signal) => {
    if (signal.status === "strong") return sum + 2;
    if (signal.status === "moderate") return sum + 1;
    return sum;
  }, 0);
  return total / (signals.length * 2);
}

function ratingFromScore(score: number): RecessionRating {
  if (score >= 0.65) return "Recession resilient";
  if (score >= 0.4) return "Mixed";
  return "Cyclical";
}

function buildSummary(
  companyName: string,
  rating: RecessionRating,
  isRecessionProof: boolean
) {
  if (isRecessionProof) {
    return `${companyName} looks recession resilient based on its sector, financial stability, and recent business trends. Defensive companies like this often hold up better when the economy slows because demand, margins, and balance sheet strength are less tied to the economic cycle.`;
  }
  if (rating === "Mixed") {
    return `${companyName} shows a mixed recession profile. It has some defensive qualities, but also cyclical traits that could pressure results in a downturn. It is not fully recession proof, but it may not be the most vulnerable name either.`;
  }
  return `${companyName} looks more cyclical than recession proof. Its sector, revenue pattern, or financial profile suggests it could feel a recession more than defensive staples, utilities, or healthcare names.`;
}

export function recessionStatusColor(status: MoatSignalStatus) {
  if (status === "strong") return "#3dd6c6";
  if (status === "moderate") return "#fbbf24";
  return "#ff7b7b";
}

export function buildRecessionAnalysis(input: {
  companyName: string;
  chart: ChartPayload;
  financials?: FinancialsPayload | null;
  revenue?: RevenuePayload | null;
  margins?: MarginsPayload | null;
  sector?: string;
  industry?: string;
}): RecessionAnalysis | null {
  const signals: MoatSignal[] = [];

  signals.push(sectorSignal(input.sector, input.industry));
  if (input.revenue) signals.push(revenueStabilitySignal(input.revenue));
  if (input.financials) signals.push(balanceSheetSignal(input.financials));
  const marginSignal = input.margins
    ? marginStabilitySignal(input.margins)
    : null;
  if (marginSignal) signals.push(marginSignal);
  const volSignal = priceVolatilitySignal(input.chart);
  if (volSignal) signals.push(volSignal);

  if (signals.length === 0) return null;

  const score = scoreSignals(signals);
  const rating = ratingFromScore(score);
  const isRecessionProof = rating === "Recession resilient";

  return {
    rating,
    isRecessionProof,
    summary: buildSummary(input.companyName, rating, isRecessionProof),
    signals,
  };
}

export function calculateRecessionProofScore(input: {
  companyName: string;
  chart: ChartPayload;
  financials?: FinancialsPayload | null;
  revenue?: RevenuePayload | null;
  margins?: MarginsPayload | null;
  sector?: string;
  industry?: string;
}): RecessionProofScore | null {
  const analysis = buildRecessionAnalysis(input);
  if (!analysis) return null;

  const score = analysis.rating === "Cyclical" ? 0 : 5;

  return {
    score,
    maxScore: 5,
    rating: analysis.rating,
    explanation: analysis.summary,
    signals: analysis.signals,
  };
}
