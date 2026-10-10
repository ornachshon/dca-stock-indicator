import type { BenchmarkComparisonPayload, RevenuePayload } from "./types";

export type SecularTrendSignalStatus = "strong" | "moderate" | "weak";

export type SecularTrendSignal = {
  label: string;
  status: SecularTrendSignalStatus;
  detail: string;
};

export type SecularTrendScore = {
  score: number;
  maxScore: 10;
  minScore: 1;
  rating: "Strong" | "Moderate" | "Weak";
  explanation: string;
  signals: SecularTrendSignal[];
};

const SECULAR_GROWTH_TERMS = [
  "software",
  "semiconductor",
  "cloud",
  "artificial intelligence",
  "machine learning",
  "biotech",
  "biotechnology",
  "cyber",
  "renewable",
  "solar",
  "e-commerce",
  "internet",
  "data center",
  "fintech",
  "digital",
  "automation",
  "electric vehicle",
  "medical device",
  "healthcare technology",
];

const SECULAR_HEADWIND_TERMS = [
  "coal",
  "tobacco",
  "newspaper",
  "printing",
  "department store",
  "legacy media",
  "wireline",
  "dial-up",
];

const GROWTH_SECTORS = new Set([
  "technology",
  "communication services",
  "healthcare",
  "health care",
]);

const HEADWIND_SECTORS = new Set(["energy"]);

function matchesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function industryTailwindSignal(sector?: string, industry?: string): SecularTrendSignal {
  const combined = `${sector ?? ""} ${industry ?? ""}`.toLowerCase().trim();
  const sectorKey = (sector ?? "").toLowerCase();

  if (matchesAny(combined, SECULAR_GROWTH_TERMS) || GROWTH_SECTORS.has(sectorKey)) {
    return {
      label: "Industry tailwind",
      status: "strong",
      detail: `${industry ?? sector ?? "This industry"} sits in a long-term growth area with structural demand tailwinds.`,
    };
  }

  if (matchesAny(combined, SECULAR_HEADWIND_TERMS) || HEADWIND_SECTORS.has(sectorKey)) {
    return {
      label: "Industry tailwind",
      status: "weak",
      detail: `${industry ?? sector ?? "This industry"} faces long-term headwinds from slower or declining secular demand.`,
    };
  }

  return {
    label: "Industry tailwind",
    status: "moderate",
    detail: `${industry ?? sector ?? "This industry"} has a mixed long-term growth profile rather than a clear secular boom or bust.`,
  };
}

function longTermRevenueSignal(revenue: RevenuePayload): SecularTrendSignal | null {
  const growthPoints = revenue.points.filter((point) => point.growthPercent != null);
  if (growthPoints.length < 2) return null;

  const average =
    Math.round(
      (growthPoints.reduce((sum, point) => sum + (point.growthPercent ?? 0), 0) /
        growthPoints.length) *
        10
    ) / 10;

  if (average >= 10) {
    return {
      label: "Long-term revenue",
      status: "strong",
      detail: `Average revenue growth of ${average.toFixed(1)}% points to a business riding a durable growth trend.`,
    };
  }

  if (average >= 3) {
    return {
      label: "Long-term revenue",
      status: "moderate",
      detail: `Average revenue growth of ${average.toFixed(1)}% shows steady but unspectacular secular momentum.`,
    };
  }

  return {
    label: "Long-term revenue",
    status: "weak",
    detail: `Average revenue growth of ${average.toFixed(1)}% suggests limited long-term demand expansion.`,
  };
}

function growthConsistencySignal(revenue: RevenuePayload): SecularTrendSignal | null {
  const growthPoints = revenue.points.filter((point) => point.growthPercent != null);
  if (growthPoints.length < 2) return null;

  const positiveYears = growthPoints.filter((point) => (point.growthPercent ?? 0) > 0).length;
  const ratio = positiveYears / growthPoints.length;

  if (ratio >= 0.8) {
    return {
      label: "Growth consistency",
      status: "strong",
      detail: "Revenue grew in most recent years, indicating a consistent long-term expansion pattern.",
    };
  }

  if (ratio >= 0.5) {
    return {
      label: "Growth consistency",
      status: "moderate",
      detail: "Revenue growth has been uneven, with both up and down years in the recent record.",
    };
  }

  return {
    label: "Growth consistency",
    status: "weak",
    detail: "Revenue often declined in recent years, which is a weak sign for a strong secular trend.",
  };
}

function marketPerformanceSignal(
  benchmark: BenchmarkComparisonPayload
): SecularTrendSignal {
  const { outperformancePercent, stockGrowthPercent, sp500GrowthPercent } = benchmark;

  if (outperformancePercent >= 20) {
    return {
      label: "5Y market performance",
      status: "strong",
      detail: `The stock beat the S&P 500 by ${outperformancePercent.toFixed(1)}% over 5 years (${stockGrowthPercent.toFixed(1)}% vs ${sp500GrowthPercent.toFixed(1)}%), suggesting strong secular momentum.`,
    };
  }

  if (outperformancePercent >= 0) {
    return {
      label: "5Y market performance",
      status: "moderate",
      detail: `The stock is ${outperformancePercent.toFixed(1)}% ahead of the S&P 500 over 5 years, showing modest long-term outperformance.`,
    };
  }

  return {
    label: "5Y market performance",
    status: "weak",
    detail: `The stock trailed the S&P 500 by ${Math.abs(outperformancePercent).toFixed(1)}% over 5 years, a weak secular trend signal.`,
  };
}

function scoreSignals(signals: SecularTrendSignal[]) {
  if (signals.length === 0) return 0;
  const total = signals.reduce((sum, signal) => {
    if (signal.status === "strong") return sum + 2;
    if (signal.status === "moderate") return sum + 1;
    return sum;
  }, 0);
  return total / (signals.length * 2);
}

function ratingLabel(score: number): SecularTrendScore["rating"] {
  if (score >= 0.65) return "Strong";
  if (score >= 0.4) return "Moderate";
  return "Weak";
}

function buildSummary(
  companyName: string,
  rating: SecularTrendScore["rating"],
  signals: SecularTrendSignal[]
) {
  const strong = signals.filter((s) => s.status === "strong").map((s) => s.label.toLowerCase());
  const weak = signals.filter((s) => s.status === "weak").map((s) => s.label.toLowerCase());

  let summary = `${companyName} shows a ${rating.toLowerCase()} secular trend profile based on industry positioning and long-term growth signals. `;

  if (strong.length > 0) {
    summary += `Tailwinds include ${strong.join(", ")}. `;
  }
  if (weak.length > 0) {
    summary += `Headwinds include ${weak.join(" and ")}. `;
  }

  return summary.trim();
}

export function calculateSecularTrendScore(input: {
  companyName: string;
  sector?: string;
  industry?: string;
  revenue?: RevenuePayload | null;
  benchmark?: BenchmarkComparisonPayload | null;
}): SecularTrendScore | null {
  const signals: SecularTrendSignal[] = [];

  if (input.sector || input.industry) {
    signals.push(industryTailwindSignal(input.sector, input.industry));
  }
  if (input.revenue) {
    const revenueSignal = longTermRevenueSignal(input.revenue);
    if (revenueSignal) signals.push(revenueSignal);
    const consistencySignal = growthConsistencySignal(input.revenue);
    if (consistencySignal) signals.push(consistencySignal);
  }
  if (input.benchmark) {
    signals.push(marketPerformanceSignal(input.benchmark));
  }

  if (signals.length === 0) return null;

  const normalized = scoreSignals(signals);
  const score = Math.max(1, Math.min(10, Math.round(normalized * 9) + 1));
  const rating = ratingLabel(normalized);

  return {
    score,
    maxScore: 10,
    minScore: 1,
    rating,
    explanation: buildSummary(input.companyName, rating, signals),
    signals,
  };
}

export function secularTrendStatusColor(status: SecularTrendSignalStatus) {
  if (status === "strong") return "#3dd6c6";
  if (status === "moderate") return "#fbbf24";
  return "#ff7b7b";
}
