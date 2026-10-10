import type {
  BenchmarkComparisonPayload,
  FinancialsPayload,
  MarginsPayload,
  RevenuePayload,
  ScaleTestPayload,
  ShortInterestPayload,
} from "./types";

export type CashVsDebtScore = {
  score: number;
  maxScore: 19;
  cashRatio: number | null;
  explanation: string;
};

export function getCashRatio(financials: FinancialsPayload): number | null {
  if (financials.cashToDebtRatio != null) return financials.cashToDebtRatio;
  if (financials.latestDebt > 0) {
    return Math.round((financials.latestCash / financials.latestDebt) * 1000) / 1000;
  }
  return null;
}

export function calculateCashVsDebtScore(
  financials: FinancialsPayload
): CashVsDebtScore {
  const { latestCash, latestDebt } = financials;
  const cashRatio = getCashRatio(financials);

  if (latestDebt <= 0 && latestCash > 0) {
    return {
      score: 19,
      maxScore: 19,
      cashRatio: null,
      explanation:
        "The company holds cash with little or no debt, so cash comfortably exceeds debt by 2x or more.",
    };
  }

  if (latestCash >= latestDebt * 2) {
    return {
      score: 19,
      maxScore: 19,
      cashRatio,
      explanation: `Cash is at least double debt (ratio ${cashRatio?.toFixed(2)}), giving the company a strong liquidity cushion.`,
    };
  }

  if (latestCash > latestDebt) {
    return {
      score: 5,
      maxScore: 19,
      cashRatio,
      explanation: `Cash exceeds debt (ratio ${cashRatio?.toFixed(2)}), but not by 2x or more.`,
    };
  }

  return {
    score: 0,
    maxScore: 19,
    cashRatio,
    explanation:
      latestDebt > latestCash
        ? `Debt is higher than cash (ratio ${cashRatio?.toFixed(2)}), which scores 0 on this metric.`
        : "Cash does not exceed debt, which scores 0 on this metric.",
  };
}

export function formatCashRatio(ratio: number | null) {
  if (ratio == null) return "N/A";
  return ratio.toFixed(2);
}

export type RevenueGrowthScore = {
  score: number;
  maxScore: 10;
  averageGrowthPercent: number | null;
  yearlyGrowth: Array<{ year: string; growthPercent: number }>;
  explanation: string;
};

export function getAverageRevenueGrowthLast3Years(
  revenue: RevenuePayload
): { average: number | null; yearlyGrowth: Array<{ year: string; growthPercent: number }> } {
  const yearlyGrowth = revenue.points
    .filter((point): point is typeof point & { growthPercent: number } =>
      point.growthPercent != null
    )
    .slice(-3);

  if (yearlyGrowth.length === 0) {
    return { average: null, yearlyGrowth: [] };
  }

  const average =
    Math.round(
      (yearlyGrowth.reduce((sum, point) => sum + point.growthPercent, 0) /
        yearlyGrowth.length) *
        10
    ) / 10;

  return {
    average,
    yearlyGrowth: yearlyGrowth.map((point) => ({
      year: point.year,
      growthPercent: point.growthPercent,
    })),
  };
}

export function calculateRevenueGrowthScore(
  revenue: RevenuePayload
): RevenueGrowthScore {
  const { average, yearlyGrowth } = getAverageRevenueGrowthLast3Years(revenue);

  if (average == null) {
    return {
      score: 0,
      maxScore: 10,
      averageGrowthPercent: null,
      yearlyGrowth: [],
      explanation: "Not enough revenue history to calculate 3-year average growth.",
    };
  }

  const yearsLabel = yearlyGrowth.map((y) => y.year).join(", ");

  if (average > 20) {
    return {
      score: 10,
      maxScore: 10,
      averageGrowthPercent: average,
      yearlyGrowth,
      explanation: `Average revenue growth over the last ${yearlyGrowth.length} year(s) (${yearsLabel}) is ${average.toFixed(1)}%, above 20%.`,
    };
  }

  if (average >= 10) {
    return {
      score: 5,
      maxScore: 10,
      averageGrowthPercent: average,
      yearlyGrowth,
      explanation: `Average revenue growth over the last ${yearlyGrowth.length} year(s) (${yearsLabel}) is ${average.toFixed(1)}%, between 10% and 20%.`,
    };
  }

  return {
    score: 0,
    maxScore: 10,
    averageGrowthPercent: average,
    yearlyGrowth,
    explanation: `Average revenue growth over the last ${yearlyGrowth.length} year(s) (${yearsLabel}) is ${average.toFixed(1)}%, under 10%.`,
  };
}

export type OperatingMarginScore = {
  score: number;
  maxScore: 10;
  operatingMarginPercent: number;
  explanation: string;
};

export function calculateOperatingMarginScore(
  margins: MarginsPayload
): OperatingMarginScore | null {
  const operatingMarginPercent = margins.latestOperatingPercent;
  if (typeof operatingMarginPercent !== "number" || Number.isNaN(operatingMarginPercent)) {
    return null;
  }

  if (operatingMarginPercent > 25) {
    return {
      score: 10,
      maxScore: 10,
      operatingMarginPercent,
      explanation: `Operating margin is ${operatingMarginPercent.toFixed(1)}%, above 25%.`,
    };
  }

  if (operatingMarginPercent >= 10) {
    return {
      score: 5,
      maxScore: 10,
      operatingMarginPercent,
      explanation: `Operating margin is ${operatingMarginPercent.toFixed(1)}%, between 10% and 25%.`,
    };
  }

  return {
    score: 0,
    maxScore: 10,
    operatingMarginPercent,
    explanation: `Operating margin is ${operatingMarginPercent.toFixed(1)}%, below 10%.`,
  };
}

export type ShortInterestScore = {
  score: number;
  maxScore: 10;
  shortPercent: number;
  explanation: string;
};

export function calculateShortInterestScore(
  shortInterest: ShortInterestPayload
): ShortInterestScore | null {
  const { shortPercent } = shortInterest;
  if (typeof shortPercent !== "number" || Number.isNaN(shortPercent)) {
    return null;
  }

  if (shortPercent >= 10) {
    return {
      score: 0,
      maxScore: 10,
      shortPercent,
      explanation: `Short interest is ${shortPercent.toFixed(1)}%, at or above 10%.`,
    };
  }

  if (shortPercent >= 5) {
    return {
      score: 5,
      maxScore: 10,
      shortPercent,
      explanation: `Short interest is ${shortPercent.toFixed(1)}%, between 5% and 10%.`,
    };
  }

  return {
    score: 10,
    maxScore: 10,
    shortPercent,
    explanation: `Short interest is ${shortPercent.toFixed(1)}%, below 5%.`,
  };
}

export type InstitutionalOwnershipScore = {
  score: number;
  maxScore: 10;
  institutionalPercent: number;
  explanation: string;
};

export function calculateInstitutionalOwnershipScore(
  stats: ShortInterestPayload
): InstitutionalOwnershipScore | null {
  const { institutionalPercent } = stats;
  if (typeof institutionalPercent !== "number" || Number.isNaN(institutionalPercent)) {
    return null;
  }

  if (institutionalPercent > 60) {
    return {
      score: 10,
      maxScore: 10,
      institutionalPercent,
      explanation: `Institutional ownership is ${institutionalPercent.toFixed(1)}%, above 60%.`,
    };
  }

  if (institutionalPercent >= 30) {
    return {
      score: 5,
      maxScore: 10,
      institutionalPercent,
      explanation: `Institutional ownership is ${institutionalPercent.toFixed(1)}%, between 30% and 60%.`,
    };
  }

  return {
    score: 0,
    maxScore: 10,
    institutionalPercent,
    explanation: `Institutional ownership is ${institutionalPercent.toFixed(1)}%, below 30%.`,
  };
}

export type ScalabilityTestScore = {
  score: number;
  maxScore: 10;
  revenueGrowth: number;
  opexGrowth: number;
  passed: boolean;
  explanation: string;
};

export function calculateScalabilityTestScore(
  scaleTest: ScaleTestPayload
): ScalabilityTestScore | null {
  const { latestRevenueGrowth, latestOpexGrowth } = scaleTest;
  if (
    typeof latestRevenueGrowth !== "number" ||
    typeof latestOpexGrowth !== "number" ||
    Number.isNaN(latestRevenueGrowth) ||
    Number.isNaN(latestOpexGrowth)
  ) {
    return null;
  }

  const passed = latestRevenueGrowth > latestOpexGrowth;

  if (passed) {
    return {
      score: 10,
      maxScore: 10,
      revenueGrowth: latestRevenueGrowth,
      opexGrowth: latestOpexGrowth,
      passed,
      explanation: `Revenue grew ${latestRevenueGrowth.toFixed(1)}% vs OpEx at ${latestOpexGrowth.toFixed(1)}%, so revenue is scaling faster than costs.`,
    };
  }

  return {
    score: 0,
    maxScore: 10,
    revenueGrowth: latestRevenueGrowth,
    opexGrowth: latestOpexGrowth,
    passed,
    explanation: `Revenue grew ${latestRevenueGrowth.toFixed(1)}% vs OpEx at ${latestOpexGrowth.toFixed(1)}%, so revenue is not growing faster than operating expenses.`,
  };
}

export type Sp500ComparisonScore = {
  score: number;
  maxScore: 10;
  stockGrowthPercent: number;
  sp500GrowthPercent: number;
  outperformancePercent: number;
  explanation: string;
};

export function calculateSp500ComparisonScore(
  benchmark: BenchmarkComparisonPayload
): Sp500ComparisonScore | null {
  const { stockGrowthPercent, sp500GrowthPercent, outperformancePercent } =
    benchmark;

  if (
    typeof stockGrowthPercent !== "number" ||
    typeof sp500GrowthPercent !== "number" ||
    typeof outperformancePercent !== "number" ||
    Number.isNaN(stockGrowthPercent) ||
    Number.isNaN(sp500GrowthPercent) ||
    Number.isNaN(outperformancePercent)
  ) {
    return null;
  }

  if (outperformancePercent >= 20) {
    return {
      score: 10,
      maxScore: 10,
      stockGrowthPercent,
      sp500GrowthPercent,
      outperformancePercent,
      explanation: `The stock gained ${stockGrowthPercent.toFixed(1)}% vs the S&P 500 at ${sp500GrowthPercent.toFixed(1)}%, beating the index by ${outperformancePercent.toFixed(1)}% over 5 years.`,
    };
  }

  if (outperformancePercent >= 10) {
    return {
      score: 5,
      maxScore: 10,
      stockGrowthPercent,
      sp500GrowthPercent,
      outperformancePercent,
      explanation: `The stock gained ${stockGrowthPercent.toFixed(1)}% vs the S&P 500 at ${sp500GrowthPercent.toFixed(1)}%, beating the index by ${outperformancePercent.toFixed(1)}% over 5 years.`,
    };
  }

  return {
    score: 0,
    maxScore: 10,
    stockGrowthPercent,
    sp500GrowthPercent,
    outperformancePercent,
    explanation:
      outperformancePercent < 0
        ? `The stock gained ${stockGrowthPercent.toFixed(1)}% vs the S&P 500 at ${sp500GrowthPercent.toFixed(1)}%, trailing the index by ${Math.abs(outperformancePercent).toFixed(1)}% over 5 years.`
        : `The stock gained ${stockGrowthPercent.toFixed(1)}% vs the S&P 500 at ${sp500GrowthPercent.toFixed(1)}%, only ${outperformancePercent.toFixed(1)}% ahead of the index over 5 years.`,
  };
}
