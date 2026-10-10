import type {
  FinancialsPayload,
  MarginsPayload,
  RevenuePayload,
  ScaleTestPayload,
} from "./types";

export type MoatSignalStatus = "strong" | "moderate" | "weak";

export type MoatSignal = {
  label: string;
  status: MoatSignalStatus;
  detail: string;
};

export type MoatAnalysis = {
  strength: "Strong" | "Moderate" | "Weak";
  summary: string;
  signals: MoatSignal[];
};

export type MoatScore = {
  score: number;
  maxScore: 10;
  minScore: 1;
  strength: MoatAnalysis["strength"];
  explanation: string;
  signals: MoatSignal[];
};

function marginSignal(margins: MarginsPayload): MoatSignal {
  const percent = margins.latestPercent;
  if (percent >= 20) {
    return {
      label: "Profitability",
      status: "strong",
      detail: `Net margin of ${percent.toFixed(1)}% indicates strong pricing power and durable economics.`,
    };
  }
  if (percent >= 10) {
    return {
      label: "Profitability",
      status: "moderate",
      detail: `Net margin of ${percent.toFixed(1)}% shows solid but not dominant profitability.`,
    };
  }
  return {
    label: "Profitability",
    status: "weak",
    detail: `Net margin of ${percent.toFixed(1)}% suggests thinner profits and a weaker economic moat.`,
  };
}

function marginTrendSignal(margins: MarginsPayload): MoatSignal | null {
  if (margins.points.length < 2) return null;
  const first = margins.points[0].percent;
  const latest = margins.points[margins.points.length - 1].percent;
  const change = latest - first;

  if (change >= 2) {
    return {
      label: "Margin trend",
      status: "strong",
      detail: `Margins expanded by ${change.toFixed(1)} pts over the period, a sign the moat may be widening.`,
    };
  }
  if (change >= -2) {
    return {
      label: "Margin trend",
      status: "moderate",
      detail: "Margins have stayed relatively stable, suggesting a steady competitive position.",
    };
  }
  return {
    label: "Margin trend",
    status: "weak",
    detail: `Margins fell by ${Math.abs(change).toFixed(1)} pts, which can signal rising competition or cost pressure.`,
  };
}

function scaleSignal(scaleTest: ScaleTestPayload): MoatSignal {
  if (scaleTest.scaleTestPassed) {
    return {
      label: "Operating leverage",
      status: "strong",
      detail: `Revenue grew ${scaleTest.latestRevenueGrowth?.toFixed(1)}% while operating expenses grew ${scaleTest.latestOpexGrowth?.toFixed(1)}%, showing efficient scaling.`,
    };
  }
  return {
    label: "Operating leverage",
    status: "weak",
    detail: `Operating expenses grew ${scaleTest.latestOpexGrowth?.toFixed(1)}% vs revenue at ${scaleTest.latestRevenueGrowth?.toFixed(1)}%, so costs are scaling faster than sales.`,
  };
}

function balanceSheetSignal(financials: FinancialsPayload): MoatSignal {
  const ratio =
    financials.cashToDebtRatio ??
    (financials.latestDebt > 0
      ? financials.latestCash / financials.latestDebt
      : null);

  if (ratio == null && financials.latestDebt <= 0 && financials.latestCash > 0) {
    return {
      label: "Balance sheet",
      status: "strong",
      detail: "The company holds cash with little or no debt, giving room to invest and endure downturns.",
    };
  }
  if (ratio != null && ratio >= 1) {
    return {
      label: "Balance sheet",
      status: "strong",
      detail: "Cash exceeds debt, providing a financial buffer that supports long-term strategy.",
    };
  }
  if (ratio != null && ratio >= 0.5) {
    return {
      label: "Balance sheet",
      status: "moderate",
      detail: "Cash and debt are balanced; the balance sheet is workable but not a major advantage.",
    };
  }
  return {
    label: "Balance sheet",
    status: "weak",
    detail: "Debt outweighs cash, which can limit flexibility if competition intensifies.",
  };
}

function revenueSignal(revenue: RevenuePayload): MoatSignal {
  const growth = revenue.latestGrowthPercent;
  if (growth == null) {
    return {
      label: "Revenue growth",
      status: "moderate",
      detail: "Not enough history to judge recent revenue momentum.",
    };
  }
  if (growth >= 10) {
    return {
      label: "Revenue growth",
      status: "strong",
      detail: `Revenue grew ${growth.toFixed(1)}% year over year, showing strong demand for the business.`,
    };
  }
  if (growth >= 0) {
    return {
      label: "Revenue growth",
      status: "moderate",
      detail: `Revenue grew ${growth.toFixed(1)}% year over year, indicating steady but unspectacular demand.`,
    };
  }
  return {
    label: "Revenue growth",
    status: "weak",
    detail: `Revenue declined ${Math.abs(growth).toFixed(1)}% year over year, which can weaken a competitive moat.`,
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

function strengthLabel(score: number): MoatAnalysis["strength"] {
  if (score >= 0.65) return "Strong";
  if (score >= 0.4) return "Moderate";
  return "Weak";
}

function buildSummary(
  companyName: string,
  strength: MoatAnalysis["strength"],
  signals: MoatSignal[]
) {
  const strong = signals.filter((s) => s.status === "strong").map((s) => s.label.toLowerCase());
  const weak = signals.filter((s) => s.status === "weak").map((s) => s.label.toLowerCase());

  let summary = `${companyName} shows a ${strength.toLowerCase()} competitive moat based on its financial profile. `;

  if (strong.length > 0) {
    summary += `Strengths include ${strong.join(", ")}. `;
  }
  if (weak.length > 0) {
    summary += `Watchpoints include ${weak.join(" and ")}. `;
  }
  summary +=
    "A moat reflects how defensible a business is — high margins, efficient scaling, and a solid balance sheet usually mean competitors have a harder time catching up.";

  return summary;
}

export function buildMoatAnalysis(input: {
  companyName: string;
  financials?: FinancialsPayload | null;
  revenue?: RevenuePayload | null;
  margins?: MarginsPayload | null;
  scaleTest?: ScaleTestPayload | null;
}): MoatAnalysis | null {
  const signals: MoatSignal[] = [];

  if (input.margins) signals.push(marginSignal(input.margins));
  const trend = input.margins ? marginTrendSignal(input.margins) : null;
  if (trend) signals.push(trend);
  if (input.scaleTest) signals.push(scaleSignal(input.scaleTest));
  if (input.financials) signals.push(balanceSheetSignal(input.financials));
  if (input.revenue) signals.push(revenueSignal(input.revenue));

  if (signals.length === 0) return null;

  const score = scoreSignals(signals);
  const strength = strengthLabel(score);

  return {
    strength,
    summary: buildSummary(input.companyName, strength, signals),
    signals,
  };
}

export function calculateMoatScore(input: {
  companyName: string;
  financials?: FinancialsPayload | null;
  revenue?: RevenuePayload | null;
  margins?: MarginsPayload | null;
  scaleTest?: ScaleTestPayload | null;
}): MoatScore | null {
  const analysis = buildMoatAnalysis(input);
  if (!analysis) return null;

  const normalized = scoreSignals(analysis.signals);
  const score = Math.max(1, Math.min(10, Math.round(normalized * 9) + 1));

  return {
    score,
    maxScore: 10,
    minScore: 1,
    strength: analysis.strength,
    explanation: analysis.summary,
    signals: analysis.signals,
  };
}

export function moatStatusColor(status: MoatSignalStatus) {
  if (status === "strong") return "#3dd6c6";
  if (status === "moderate") return "#fbbf24";
  return "#ff7b7b";
}
