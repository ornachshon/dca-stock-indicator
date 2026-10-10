export type StockSuggestion = {
  symbol: string;
  name: string;
  exchange: string;
};

export type PricePoint = {
  date: string;
  close: number;
  doubleDown: boolean;
};

export type StockStatus = "double_down" | "normal";

export type ChartPayload = {
  symbol: string;
  name: string;
  currency: string;
  sector?: string;
  industry?: string;
  prices: PricePoint[];
  yearHigh: number;
  doubleDownPrice: number;
  currentPrice: number;
  dropPercent: number;
  status: StockStatus;
};

export type DebtCashPoint = {
  period: string;
  cash: number;
  debt: number;
};

export type FinancialsPayload = {
  symbol: string;
  currency: string;
  points: DebtCashPoint[];
  latestCash: number;
  latestDebt: number;
  netDebt: number;
  cashToDebtRatio: number | null;
};

export type RevenuePoint = {
  year: string;
  revenue: number;
  growthPercent: number | null;
};

export type RevenuePayload = {
  symbol: string;
  currency: string;
  points: RevenuePoint[];
  latestRevenue: number;
  latestGrowthPercent: number | null;
};

export type MarginPoint = {
  year: string;
  amount: number;
  percent: number;
};

export type MarginsPayload = {
  symbol: string;
  currency: string;
  points: MarginPoint[];
  latestAmount: number;
  latestPercent: number;
  latestOperatingAmount: number;
  latestOperatingPercent: number;
};

export type PeRatioPoint = {
  date: string;
  pe: number;
};

export type PeRatioPayload = {
  symbol: string;
  points: PeRatioPoint[];
  latestPe: number;
  trailingPe: number | null;
};

export type ScaleTestPoint = {
  year: string;
  revenueGrowth: number | null;
  opexGrowth: number | null;
};

export type ScaleTestPayload = {
  symbol: string;
  currency: string;
  points: ScaleTestPoint[];
  latestRevenueGrowth: number | null;
  latestOpexGrowth: number | null;
  scaleTestPassed: boolean | null;
};

export type CeoPayload = {
  symbol: string;
  companyName: string;
  name: string;
  title: string;
  description: string;
  since?: string;
  tenureYears?: number | null;
  tenureStockGrowthPercent?: number | null;
  tenureSp500GrowthPercent?: number | null;
  tenureOutperformancePercent?: number | null;
};

export type ShortInterestPayload = {
  symbol: string;
  shortPercent: number | null;
  shortRatio: number | null;
  sharesShort: number | null;
  institutionalPercent: number | null;
};

export type BenchmarkComparisonPayload = {
  symbol: string;
  stockGrowthPercent: number;
  sp500GrowthPercent: number;
  outperformancePercent: number;
};

export type CultureMissionPayload = {
  symbol: string;
  companyName: string;
  summary: string;
};
