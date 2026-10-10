import type {
  CultureMissionPayload,
  MarginsPayload,
  RevenuePayload,
  ScaleTestPayload,
} from "./types";

export type TalentSignalStatus = "strong" | "moderate" | "weak";

export type TalentSignal = {
  label: string;
  status: TalentSignalStatus;
  detail: string;
};

export type TalentScore = {
  score: number;
  maxScore: 10;
  minScore: 1;
  rating: "Strong" | "Moderate" | "Weak";
  explanation: string;
  signals: TalentSignal[];
};

const TALENT_SECTORS = new Set([
  "technology",
  "healthcare",
  "health care",
  "communication services",
]);

function countMatches(text: string, terms: string[]) {
  return terms.reduce(
    (count, term) => (text.includes(term) ? count + 1 : count),
    0
  );
}

function statusFromCount(count: number, strongAt: number, moderateAt: number) {
  if (count >= strongAt) return "strong" as const;
  if (count >= moderateAt) return "moderate" as const;
  return "weak" as const;
}

function peopleTalentSignal(summary?: string): TalentSignal {
  if (!summary) {
    return {
      label: "People focus",
      status: "moderate",
      detail: "No public company profile available to assess people and talent language.",
    };
  }

  const text = summary.toLowerCase();
  const count = countMatches(text, [
    "employee",
    "workforce",
    "talent",
    "engineer",
    "developer",
    "scientist",
    "researcher",
    "people",
    "team",
    "hire",
  ]);
  const status = statusFromCount(count, 3, 1);

  if (status === "strong") {
    return {
      label: "People focus",
      status,
      detail: "Public profile emphasizes employees, skilled teams, and human capital.",
    };
  }
  if (status === "moderate") {
    return {
      label: "People focus",
      status,
      detail: "Some people or workforce language appears in the public profile.",
    };
  }
  return {
    label: "People focus",
    status,
    detail: "People and talent themes are not prominent in the public company description.",
  };
}

function innovationTalentSignal(summary?: string): TalentSignal {
  if (!summary) {
    return {
      label: "Innovation talent",
      status: "moderate",
      detail: "Innovation hiring signals are unavailable without a public company profile.",
    };
  }

  const text = summary.toLowerCase();
  const count = countMatches(text, [
    "research",
    "development",
    "innovation",
    "technology",
    "patent",
    "software",
    "design",
    "engineering",
  ]);
  const status = statusFromCount(count, 3, 1);

  if (status === "strong") {
    return {
      label: "Innovation talent",
      status,
      detail: "The business profile points to innovation-heavy work that typically attracts skilled talent.",
    };
  }
  if (status === "moderate") {
    return {
      label: "Innovation talent",
      status,
      detail: "Some innovation or technical work appears in the public profile.",
    };
  }
  return {
    label: "Innovation talent",
    status,
    detail: "The public profile does not strongly emphasize innovation-driven talent needs.",
  };
}

function industryTalentSignal(sector?: string, industry?: string): TalentSignal | null {
  if (!sector && !industry) return null;
  const combined = `${sector ?? ""} ${industry ?? ""}`.toLowerCase();

  if (TALENT_SECTORS.has((sector ?? "").toLowerCase()) || combined.includes("software")) {
    return {
      label: "Talent market",
      status: "strong",
      detail: `${industry ?? sector} operates in a sector where attracting top talent is critical to winning.`,
    };
  }

  if (combined.includes("financial") || combined.includes("consulting")) {
    return {
      label: "Talent market",
      status: "moderate",
      detail: `${industry ?? sector} relies on skilled professionals, but with a different talent profile than tech.`,
    };
  }

  return {
    label: "Talent market",
    status: "moderate",
    detail: `${industry ?? sector ?? "This sector"} has a mixed talent intensity profile.`,
  };
}

function growthHiringSignal(
  revenue?: RevenuePayload | null,
  scaleTest?: ScaleTestPayload | null
): TalentSignal | null {
  if (!revenue && !scaleTest) return null;

  const revenueGrowth = revenue?.latestGrowthPercent;
  const scalingWell = scaleTest?.scaleTestPassed === true;

  if (revenueGrowth != null && revenueGrowth >= 10 && scalingWell) {
    return {
      label: "Growth hiring",
      status: "strong",
      detail: `Revenue grew ${revenueGrowth.toFixed(1)}% with efficient scaling, a strong setup for talent investment.`,
    };
  }

  if (revenueGrowth != null && revenueGrowth >= 0) {
    return {
      label: "Growth hiring",
      status: "moderate",
      detail: `Revenue grew ${revenueGrowth.toFixed(1)}% recently, suggesting steady but not explosive hiring demand.`,
    };
  }

  if (revenueGrowth != null && revenueGrowth < 0) {
    return {
      label: "Growth hiring",
      status: "weak",
      detail: `Revenue declined ${Math.abs(revenueGrowth).toFixed(1)}%, which often pressures hiring and retention.`,
    };
  }

  return {
    label: "Growth hiring",
    status: "moderate",
    detail: "Recent growth data is limited, so hiring momentum is unclear.",
  };
}

function compensationCapacitySignal(margins?: MarginsPayload | null): TalentSignal | null {
  if (!margins) return null;

  const margin = margins.latestOperatingPercent;
  if (typeof margin !== "number" || Number.isNaN(margin)) return null;

  if (margin >= 20) {
    return {
      label: "Comp capacity",
      status: "strong",
      detail: `Operating margin of ${margin.toFixed(1)}% suggests strong ability to fund competitive talent.`,
    };
  }

  if (margin >= 10) {
    return {
      label: "Comp capacity",
      status: "moderate",
      detail: `Operating margin of ${margin.toFixed(1)}% supports reasonable talent investment.`,
    };
  }

  return {
    label: "Comp capacity",
    status: "weak",
    detail: `Operating margin of ${margin.toFixed(1)}% leaves less room to compete on compensation.`,
  };
}

function scoreSignals(signals: TalentSignal[]) {
  if (signals.length === 0) return 0;
  const total = signals.reduce((sum, signal) => {
    if (signal.status === "strong") return sum + 2;
    if (signal.status === "moderate") return sum + 1;
    return sum;
  }, 0);
  return total / (signals.length * 2);
}

function ratingLabel(score: number): TalentScore["rating"] {
  if (score >= 0.65) return "Strong";
  if (score >= 0.4) return "Moderate";
  return "Weak";
}

function buildSummary(
  companyName: string,
  rating: TalentScore["rating"],
  signals: TalentSignal[]
) {
  const strong = signals.filter((s) => s.status === "strong").map((s) => s.label.toLowerCase());
  const weak = signals.filter((s) => s.status === "weak").map((s) => s.label.toLowerCase());

  let summary = `${companyName} shows a ${rating.toLowerCase()} talent profile based on people focus, innovation intensity, and financial capacity to hire. `;

  if (strong.length > 0) {
    summary += `Strengths include ${strong.join(", ")}. `;
  }
  if (weak.length > 0) {
    summary += `Weak spots include ${weak.join(" and ")}. `;
  }

  return summary.trim();
}

export function calculateTalentScore(input: {
  companyName: string;
  culture?: CultureMissionPayload | null;
  sector?: string;
  industry?: string;
  revenue?: RevenuePayload | null;
  margins?: MarginsPayload | null;
  scaleTest?: ScaleTestPayload | null;
}): TalentScore | null {
  const signals: TalentSignal[] = [
    peopleTalentSignal(input.culture?.summary),
    innovationTalentSignal(input.culture?.summary),
  ];

  const industrySignal = industryTalentSignal(input.sector, input.industry);
  if (industrySignal) signals.push(industrySignal);

  const growthSignal = growthHiringSignal(input.revenue, input.scaleTest);
  if (growthSignal) signals.push(growthSignal);

  const compSignal = compensationCapacitySignal(input.margins);
  if (compSignal) signals.push(compSignal);

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

export function talentStatusColor(status: TalentSignalStatus) {
  if (status === "strong") return "#3dd6c6";
  if (status === "moderate") return "#fbbf24";
  return "#ff7b7b";
}
