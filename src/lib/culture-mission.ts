import type { CultureMissionPayload } from "./types";

export type CultureMissionSignalStatus = "strong" | "moderate" | "weak";

export type CultureMissionSignal = {
  label: string;
  status: CultureMissionSignalStatus;
  detail: string;
};

export type CultureMissionScore = {
  score: number;
  maxScore: 10;
  minScore: 1;
  rating: "Strong" | "Moderate" | "Weak";
  explanation: string;
  signals: CultureMissionSignal[];
};

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

function missionClaritySignal(text: string): CultureMissionSignal {
  const count = countMatches(text, [
    "mission",
    "purpose",
    "vision",
    "aims to",
    "committed to",
    "strive",
    "goal is",
  ]);
  const status = statusFromCount(count, 3, 1);

  if (status === "strong") {
    return {
      label: "Mission clarity",
      status,
      detail: "Public profile clearly references mission, purpose, or long-term vision.",
    };
  }
  if (status === "moderate") {
    return {
      label: "Mission clarity",
      status,
      detail: "Some mission or purpose language appears, but it is not deeply emphasized.",
    };
  }
  return {
    label: "Mission clarity",
    status,
    detail: "Little explicit mission or purpose language is visible in the public profile.",
  };
}

function valuesCultureSignal(text: string): CultureMissionSignal {
  const count = countMatches(text, [
    "values",
    "culture",
    "integrity",
    "ethics",
    "principles",
    "trust",
    "respect",
  ]);
  const status = statusFromCount(count, 2, 1);

  if (status === "strong") {
    return {
      label: "Values & culture",
      status,
      detail: "The company profile highlights values, culture, or ethical principles.",
    };
  }
  if (status === "moderate") {
    return {
      label: "Values & culture",
      status,
      detail: "Values or culture are mentioned, but not as a central theme.",
    };
  }
  return {
    label: "Values & culture",
    status,
    detail: "Values and culture are not prominent in the available public description.",
  };
}

function stakeholderSignal(text: string): CultureMissionSignal {
  const count = countMatches(text, [
    "employee",
    "community",
    "customer",
    "sustainability",
    "environment",
    "diversity",
    "stakeholder",
    "people",
    "social",
  ]);
  const status = statusFromCount(count, 3, 1);

  if (status === "strong") {
    return {
      label: "Stakeholder focus",
      status,
      detail: "Strong emphasis on employees, customers, community, or sustainability.",
    };
  }
  if (status === "moderate") {
    return {
      label: "Stakeholder focus",
      status,
      detail: "Some stakeholder or social responsibility themes are present.",
    };
  }
  return {
    label: "Stakeholder focus",
    status,
    detail: "Limited emphasis on people, community, or broader stakeholder impact.",
  };
}

function purposeOrientationSignal(text: string): CultureMissionSignal {
  const count = countMatches(text, [
    "innovation",
    "research",
    "improve",
    "empower",
    "transform",
    "quality",
    "service",
    "leadership",
    "long-term",
  ]);
  const status = statusFromCount(count, 3, 1);

  if (status === "strong") {
    return {
      label: "Purpose orientation",
      status,
      detail: "Language points to innovation, service, and long-term purpose beyond short-term profits.",
    };
  }
  if (status === "moderate") {
    return {
      label: "Purpose orientation",
      status,
      detail: "Some purpose-driven language appears around innovation or service.",
    };
  }
  return {
    label: "Purpose orientation",
    status,
    detail: "The public profile reads more transactional than purpose-driven.",
  };
}

function scoreSignals(signals: CultureMissionSignal[]) {
  if (signals.length === 0) return 0;
  const total = signals.reduce((sum, signal) => {
    if (signal.status === "strong") return sum + 2;
    if (signal.status === "moderate") return sum + 1;
    return sum;
  }, 0);
  return total / (signals.length * 2);
}

function ratingLabel(score: number): CultureMissionScore["rating"] {
  if (score >= 0.65) return "Strong";
  if (score >= 0.4) return "Moderate";
  return "Weak";
}

function buildSummary(
  companyName: string,
  rating: CultureMissionScore["rating"],
  signals: CultureMissionSignal[]
) {
  const strong = signals.filter((s) => s.status === "strong").map((s) => s.label.toLowerCase());
  const weak = signals.filter((s) => s.status === "weak").map((s) => s.label.toLowerCase());

  let summary = `${companyName} scores a ${rating.toLowerCase()} culture and mission profile based on its public company description. `;

  if (strong.length > 0) {
    summary += `Positive themes include ${strong.join(", ")}. `;
  }
  if (weak.length > 0) {
    summary += `Gaps include ${weak.join(" and ")}. `;
  }

  summary +=
    "This score reflects publicly visible mission and values language, not internal employee sentiment.";

  return summary;
}

export function calculateCultureMissionScore(
  payload: CultureMissionPayload
): CultureMissionScore | null {
  if (!payload.summary?.trim()) return null;

  const text = payload.summary.toLowerCase();
  const signals = [
    missionClaritySignal(text),
    valuesCultureSignal(text),
    stakeholderSignal(text),
    purposeOrientationSignal(text),
  ];

  const normalized = scoreSignals(signals);
  const score = Math.max(1, Math.min(10, Math.round(normalized * 9) + 1));
  const rating = ratingLabel(normalized);

  return {
    score,
    maxScore: 10,
    minScore: 1,
    rating,
    explanation: buildSummary(payload.companyName, rating, signals),
    signals,
  };
}

export function cultureMissionStatusColor(status: CultureMissionSignalStatus) {
  if (status === "strong") return "#3dd6c6";
  if (status === "moderate") return "#fbbf24";
  return "#ff7b7b";
}
