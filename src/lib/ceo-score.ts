import type { CeoPayload, RevenuePayload } from "./types";

export type CeoSignalStatus = "strong" | "moderate" | "weak";

export type CeoSignal = {
  label: string;
  status: CeoSignalStatus;
  detail: string;
};

export type CeoScore = {
  score: number;
  maxScore: 10;
  minScore: 1;
  rating: "Strong" | "Moderate" | "Weak";
  explanation: string;
  signals: CeoSignal[];
};

function scoreSignals(signals: CeoSignal[]) {
  if (signals.length === 0) return 0;
  const total = signals.reduce((sum, signal) => {
    if (signal.status === "strong") return sum + 2;
    if (signal.status === "moderate") return sum + 1;
    return sum;
  }, 0);
  return total / (signals.length * 2);
}

function ratingLabel(score: number): CeoScore["rating"] {
  if (score >= 0.65) return "Strong";
  if (score >= 0.4) return "Moderate";
  return "Weak";
}

function tenureSignal(ceo: CeoPayload): CeoSignal {
  if (ceo.tenureYears == null) {
    return {
      label: "Tenure",
      status: "moderate",
      detail: "CEO tenure length is unavailable.",
    };
  }

  if (ceo.tenureYears >= 10) {
    return {
      label: "Tenure",
      status: "strong",
      detail: `${ceo.name} has led the company for ${ceo.tenureYears} years, showing long-term leadership stability.`,
    };
  }

  if (ceo.tenureYears >= 5) {
    return {
      label: "Tenure",
      status: "moderate",
      detail: `${ceo.name} has been CEO for ${ceo.tenureYears} years, with a solid but still developing track record.`,
    };
  }

  return {
    label: "Tenure",
    status: "weak",
    detail: `${ceo.name} has been CEO for ${ceo.tenureYears} year(s), so the leadership track record is still limited.`,
  };
}

function tenurePerformanceSignal(ceo: CeoPayload): CeoSignal | null {
  const { tenureOutperformancePercent, tenureStockGrowthPercent, tenureSp500GrowthPercent } =
    ceo;

  if (
    tenureOutperformancePercent == null ||
    tenureStockGrowthPercent == null ||
    tenureSp500GrowthPercent == null
  ) {
    return null;
  }

  if (tenureOutperformancePercent >= 20) {
    return {
      label: "Tenure performance",
      status: "strong",
      detail: `Since appointment, the stock gained ${tenureStockGrowthPercent.toFixed(1)}% vs the S&P 500 at ${tenureSp500GrowthPercent.toFixed(1)}%, beating the market by ${tenureOutperformancePercent.toFixed(1)}%.`,
    };
  }

  if (tenureOutperformancePercent >= 0) {
    return {
      label: "Tenure performance",
      status: "moderate",
      detail: `Since appointment, the stock gained ${tenureStockGrowthPercent.toFixed(1)}% vs the S&P 500 at ${tenureSp500GrowthPercent.toFixed(1)}%, modestly ahead of the market.`,
    };
  }

  return {
    label: "Tenure performance",
    status: "weak",
    detail: `Since appointment, the stock gained ${tenureStockGrowthPercent.toFixed(1)}% vs the S&P 500 at ${tenureSp500GrowthPercent.toFixed(1)}%, trailing the market by ${Math.abs(tenureOutperformancePercent).toFixed(1)}%.`,
  };
}

function revenueSignal(revenue: RevenuePayload): CeoSignal {
  const growth = revenue.latestGrowthPercent;
  if (growth == null) {
    return {
      label: "Revenue momentum",
      status: "moderate",
      detail: "Not enough revenue history to judge recent business momentum.",
    };
  }

  if (growth >= 10) {
    return {
      label: "Revenue momentum",
      status: "strong",
      detail: `Revenue grew ${growth.toFixed(1)}% year over year under current leadership.`,
    };
  }

  if (growth >= 0) {
    return {
      label: "Revenue momentum",
      status: "moderate",
      detail: `Revenue grew ${growth.toFixed(1)}% year over year, showing steady but unspectacular progress.`,
    };
  }

  return {
    label: "Revenue momentum",
    status: "weak",
    detail: `Revenue declined ${Math.abs(growth).toFixed(1)}% year over year, a weak result for leadership.`,
  };
}

function moatSignal(moatScore: number): CeoSignal {
  if (moatScore >= 8) {
    return {
      label: "Business quality",
      status: "strong",
      detail: `The company scores ${moatScore}/10 on moat strength, suggesting durable competitive advantages.`,
    };
  }

  if (moatScore >= 5) {
    return {
      label: "Business quality",
      status: "moderate",
      detail: `The company scores ${moatScore}/10 on moat strength, indicating a decent but not dominant business.`,
    };
  }

  return {
    label: "Business quality",
    status: "weak",
    detail: `The company scores ${moatScore}/10 on moat strength, suggesting a weaker competitive position.`,
  };
}

function buildSummary(
  ceo: CeoPayload,
  rating: CeoScore["rating"],
  signals: CeoSignal[]
) {
  const strong = signals.filter((s) => s.status === "strong").map((s) => s.label.toLowerCase());
  const weak = signals.filter((s) => s.status === "weak").map((s) => s.label.toLowerCase());

  let summary = `${ceo.name} receives a ${rating.toLowerCase()} CEO rating based on tenure, company performance, and business quality. `;

  if (strong.length > 0) {
    summary += `Strengths include ${strong.join(", ")}. `;
  }
  if (weak.length > 0) {
    summary += `Weak spots include ${weak.join(" and ")}. `;
  }

  return summary.trim();
}

export function calculateCeoScore(input: {
  ceo: CeoPayload;
  revenue?: RevenuePayload | null;
  moatScore?: number | null;
}): CeoScore | null {
  const signals: CeoSignal[] = [tenureSignal(input.ceo)];

  const performance = tenurePerformanceSignal(input.ceo);
  if (performance) signals.push(performance);
  if (input.revenue) signals.push(revenueSignal(input.revenue));
  if (input.moatScore != null) signals.push(moatSignal(input.moatScore));

  const normalized = scoreSignals(signals);
  const score = Math.max(1, Math.min(10, Math.round(normalized * 9) + 1));
  const rating = ratingLabel(normalized);

  return {
    score,
    maxScore: 10,
    minScore: 1,
    rating,
    explanation: buildSummary(input.ceo, rating, signals),
    signals,
  };
}

export function ceoStatusColor(status: CeoSignalStatus) {
  if (status === "strong") return "#3dd6c6";
  if (status === "moderate") return "#fbbf24";
  return "#ff7b7b";
}
