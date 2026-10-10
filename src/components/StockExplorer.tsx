"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_RANGE_GROUPS, type ChartRange } from "../lib/chart-range";
import type {
  BenchmarkComparisonPayload,
  CultureMissionPayload,
  ChartPayload,
  CeoPayload,
  DebtCashPoint,
  FinancialsPayload,
  MarginsPayload,
  PeRatioPayload,
  PricePoint,
  RevenuePayload,
  ScaleTestPayload,
  ShortInterestPayload,
  StockSuggestion,
} from "../lib/types";
import { calculateCultureMissionScore, cultureMissionStatusColor } from "../lib/culture-mission";
import { calculateTalentScore, talentStatusColor } from "../lib/talent";
import { calculateCeoScore, ceoStatusColor } from "../lib/ceo-score";
import { calculateSecularTrendScore, secularTrendStatusColor } from "../lib/secular-trend";
import { buildMoatAnalysis, calculateMoatScore, moatStatusColor } from "../lib/moat";
import { buildRecessionAnalysis, calculateRecessionProofScore, recessionStatusColor } from "../lib/recession";
import {
  calculateCashVsDebtScore,
  calculateInstitutionalOwnershipScore,
  calculateOperatingMarginScore,
  calculateRevenueGrowthScore,
  calculateScalabilityTestScore,
  calculateShortInterestScore,
  calculateSp500ComparisonScore,
  formatCashRatio,
} from "../lib/score";

const NORMAL_BAR = "#4f8cff";
const DOUBLE_DOWN_BAR = "#f0a04b";
const YEAR_HIGH_LINE = "#e8eef9";
const CASH_BAR = "#3dd6c6";
const DEBT_BAR = "#ff7b7b";
const REVENUE_BAR = "#a78bfa";
const GROWTH_LINE = "#3dd6c6";
const MARGIN_BAR = "#fbbf24";
const MARGIN_LINE = "#3dd6c6";
const PE_LINE = "#818cf8";
const OPEX_GROWTH = "#ff7b7b";

type AnalysisTab = "price" | "financials" | "insights" | "score";

function AnalysisTabBar({
  active,
  onChange,
}: {
  active: AnalysisTab;
  onChange: (tab: AnalysisTab) => void;
}) {
  const tabs: { id: AnalysisTab; label: string }[] = [
    { id: "price", label: "Price chart" },
    { id: "financials", label: "Financials" },
    { id: "insights", label: "Insights" },
    { id: "score", label: "Score" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Stock analysis sections"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginBottom: 20,
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              border: `1px solid ${isActive ? "var(--accent-dim)" : "var(--line)"}`,
              borderRadius: 999,
              padding: "10px 16px",
              background: isActive ? "rgba(61, 214, 198, 0.14)" : "var(--bg-soft)",
              color: isActive ? "var(--accent)" : "var(--muted)",
              fontSize: "0.92rem",
              fontWeight: isActive ? 650 : 500,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function ChartRangeFilter({
  active,
  loading,
  onChange,
}: {
  active: ChartRange;
  loading: boolean;
  onChange: (range: ChartRange) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 16,
        marginBottom: 16,
        opacity: loading ? 0.65 : 1,
        transition: "opacity 0.15s ease",
      }}
    >
      {CHART_RANGE_GROUPS.map((group) => (
        <div
          key={group.label}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--muted)",
              minWidth: 52,
            }}
          >
            {group.label}
          </span>
          {group.options.map((option) => {
            const isActive = active === option.id;
            return (
              <button
                key={option.id}
                type="button"
                disabled={loading}
                onClick={() => onChange(option.id)}
                style={{
                  border: `1px solid ${isActive ? "var(--accent-dim)" : "var(--line)"}`,
                  borderRadius: 999,
                  padding: "6px 12px",
                  background: isActive ? "rgba(61, 214, 198, 0.14)" : "var(--bg-soft)",
                  color: isActive ? "var(--accent)" : "var(--muted)",
                  fontSize: "0.82rem",
                  fontWeight: isActive ? 650 : 500,
                  cursor: loading ? "wait" : "pointer",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function formatBillions(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

function getCashToDebtRatio(financials: FinancialsPayload): number | null {
  if (financials.cashToDebtRatio != null) return financials.cashToDebtRatio;
  if (financials.latestDebt > 0) {
    return Math.round((financials.latestCash / financials.latestDebt) * 1000) / 1000;
  }
  return null;
}

function formatCashToDebtRatio(financials: FinancialsPayload) {
  if (financials.latestDebt <= 0 && financials.latestCash > 0) return "∞";
  const ratio = getCashToDebtRatio(financials);
  return ratio != null ? ratio.toFixed(2) : "N/A";
}

function withRatio(points: DebtCashPoint[]) {
  return points.map((point) => ({
    ...point,
    ratio:
      point.debt > 0
        ? Math.round((point.cash / point.debt) * 1000) / 1000
        : null,
  }));
}

function ratioAxisDomain(
  points: ReturnType<typeof withRatio>
): [number, number] {
  const ratios = points
    .map((point) => point.ratio)
    .filter((value): value is number => value != null);
  if (ratios.length === 0) return [0, 1];

  const min = Math.min(...ratios);
  const max = Math.max(...ratios);
  const padding = Math.max((max - min) * 0.25, 0.05);
  return [Math.max(0, min - padding), max + padding];
}

function percentAxisDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 100];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = Math.max((max - min) * 0.25, 1);
  return [min - padding, max + padding];
}

function growthAxisDomain(
  points: Array<{ revenueGrowth: number | null; opexGrowth: number | null }>
): [number, number] {
  const values = points.flatMap((point) =>
    [point.revenueGrowth, point.opexGrowth].filter(
      (value): value is number => value != null
    )
  );
  return percentAxisDomain(values);
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload?: PricePoint;
    value?: number | string | (number | string)[];
  }>;
  label?: string | number;
  currency: string;
};

function ChartTooltip({ active, payload, label, currency }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const rawValue = payload[0].value;
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  const isDoubleDownBar = point?.doubleDown ?? false;
  const num = typeof value === "number" ? value : Number(value);
  const statusLabel = isDoubleDownBar ? "Close · Double down" : "Close · Normal";

  return (
    <div
      style={{
        background: "#121a2b",
        border: "1px solid #243047",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ color: "#e8eef9", fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: isDoubleDownBar ? DOUBLE_DOWN_BAR : "#93a4c3" }}>
        {statusLabel} : {Number.isFinite(num) ? num.toFixed(2) : value} {currency}
      </div>
    </div>
  );
}

function FinancialsTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    value?: number | string | (number | string)[];
  }>;
  label?: string | number;
  currency: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "#121a2b",
        border: "1px solid #243047",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ color: "#e8eef9", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      {payload.map((item) => {
        const rawValue = item.value;
        const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
        const num = typeof value === "number" ? value : Number(value);
        const key = String(item.dataKey);
        const isCash = key === "cash";
        const isRatio = key === "ratio";

        if (isRatio && !Number.isFinite(num)) return null;

        return (
          <div
            key={key}
            style={{
              color: isRatio ? NORMAL_BAR : isCash ? CASH_BAR : DEBT_BAR,
              fontSize: "0.9rem",
              marginTop: 2,
            }}
          >
            {isRatio
              ? `Cash/debt ratio: ${num.toFixed(2)}`
              : isCash
                ? `Cash: ${Number.isFinite(num) ? formatBillions(num) : value} ${currency}`
                : `Debt: ${Number.isFinite(num) ? formatBillions(num) : value} ${currency}`}
          </div>
        );
      })}
    </div>
  );
}

function ScaleTestTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    value?: number | string | (number | string)[];
  }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "#121a2b",
        border: "1px solid #243047",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ color: "#e8eef9", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      {payload.map((item) => {
        const rawValue = item.value;
        const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
        const num = typeof value === "number" ? value : Number(value);
        const key = String(item.dataKey);
        const isRevenue = key === "revenueGrowth";

        if (!Number.isFinite(num)) return null;

        return (
          <div
            key={key}
            style={{
              color: isRevenue ? REVENUE_BAR : OPEX_GROWTH,
              fontSize: "0.9rem",
              marginTop: 2,
            }}
          >
            {isRevenue ? "Revenue growth" : "OpEx growth"}: {formatGrowth(num)}
          </div>
        );
      })}
    </div>
  );
}

function formatGrowth(value: number | null) {
  if (value == null) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function MarginTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    value?: number | string | (number | string)[];
  }>;
  label?: string | number;
  currency: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "#121a2b",
        border: "1px solid #243047",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ color: "#e8eef9", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      {payload.map((item) => {
        const rawValue = item.value;
        const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
        const num = typeof value === "number" ? value : Number(value);
        const key = String(item.dataKey);
        const isPercent = key === "percent";

        return (
          <div
            key={key}
            style={{
              color: isPercent ? MARGIN_LINE : MARGIN_BAR,
              fontSize: "0.9rem",
              marginTop: 2,
            }}
          >
            {isPercent
              ? `Net margin: ${Number.isFinite(num) ? `${num.toFixed(1)}%` : value}`
              : `Net income: ${Number.isFinite(num) ? formatBillions(num) : value} ${currency}`}
          </div>
        );
      })}
    </div>
  );
}

function RevenueTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    dataKey?: string | number;
    value?: number | string | (number | string)[];
  }>;
  label?: string | number;
  currency: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        background: "#121a2b",
        border: "1px solid #243047",
        borderRadius: 10,
        padding: "10px 12px",
      }}
    >
      <div style={{ color: "#e8eef9", fontWeight: 600, marginBottom: 6 }}>
        {label}
      </div>
      {payload.map((item) => {
        const rawValue = item.value;
        const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
        const num = typeof value === "number" ? value : Number(value);
        const key = String(item.dataKey);
        const isGrowth = key === "growthPercent";

        if (isGrowth && !Number.isFinite(num)) return null;

        return (
          <div
            key={key}
            style={{
              color: isGrowth ? GROWTH_LINE : REVENUE_BAR,
              fontSize: "0.9rem",
              marginTop: 2,
            }}
          >
            {isGrowth
              ? `YoY growth: ${formatGrowth(num)}`
              : `Revenue: ${Number.isFinite(num) ? formatBillions(num) : value} ${currency}`}
          </div>
        );
      })}
    </div>
  );
}

export function StockExplorer() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingChart, setLoadingChart] = useState(false);
  const [loadingPriceChart, setLoadingPriceChart] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chart, setChart] = useState<ChartPayload | null>(null);
  const [chartRange, setChartRange] = useState<ChartRange>("1y");
  const [financials, setFinancials] = useState<FinancialsPayload | null>(null);
  const [financialsError, setFinancialsError] = useState<string | null>(null);
  const [revenue, setRevenue] = useState<RevenuePayload | null>(null);
  const [revenueError, setRevenueError] = useState<string | null>(null);
  const [margins, setMargins] = useState<MarginsPayload | null>(null);
  const [marginsError, setMarginsError] = useState<string | null>(null);
  const [peRatio, setPeRatio] = useState<PeRatioPayload | null>(null);
  const [peRatioError, setPeRatioError] = useState<string | null>(null);
  const [scaleTest, setScaleTest] = useState<ScaleTestPayload | null>(null);
  const [scaleTestError, setScaleTestError] = useState<string | null>(null);
  const [ceo, setCeo] = useState<CeoPayload | null>(null);
  const [ceoError, setCeoError] = useState<string | null>(null);
  const [shortInterest, setShortInterest] = useState<ShortInterestPayload | null>(null);
  const [shortInterestError, setShortInterestError] = useState<string | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkComparisonPayload | null>(null);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [culture, setCulture] = useState<CultureMissionPayload | null>(null);
  const [cultureError, setCultureError] = useState<string | null>(null);
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("price");
  const wrapRef = useRef<HTMLDivElement>(null);
  const loadIdRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        setSuggestions(data.results ?? []);
        setOpen(true);
        setActiveIndex(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setSuggestions([]);
        }
      } finally {
        setLoadingSearch(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function loadChart(symbol: string) {
    const loadId = ++loadIdRef.current;
    const queryAtStart = query;
    setLoadingChart(true);
    setError(null);
    setChartRange("1y");
    setFinancials(null);
    setFinancialsError(null);
    setRevenue(null);
    setRevenueError(null);
    setMargins(null);
    setMarginsError(null);
    setPeRatio(null);
    setPeRatioError(null);
    setScaleTest(null);
    setScaleTestError(null);
    setCeo(null);
    setCeoError(null);
    setShortInterest(null);
    setShortInterestError(null);
    setBenchmark(null);
    setBenchmarkError(null);
    setCulture(null);
    setCultureError(null);
    setAnalysisTab("price");
    setOpen(false);
    setSuggestions([]);
    try {
      const [chartRes, financialsRes, revenueRes, marginsRes, peRatioRes, scaleTestRes, ceoRes, shortInterestRes, benchmarkRes, cultureRes] =
        await Promise.all([
        fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&range=1y`),
        fetch(`/api/financials?symbol=${encodeURIComponent(symbol)}`),
        fetch(`/api/revenue?symbol=${encodeURIComponent(symbol)}`),
        fetch(`/api/margins?symbol=${encodeURIComponent(symbol)}`),
        fetch(`/api/pe-ratio?symbol=${encodeURIComponent(symbol)}&range=1y`),
        fetch(`/api/scale-test?symbol=${encodeURIComponent(symbol)}`),
        fetch(`/api/ceo?symbol=${encodeURIComponent(symbol)}`),
        fetch(`/api/short-interest?symbol=${encodeURIComponent(symbol)}`),
        fetch(`/api/benchmark?symbol=${encodeURIComponent(symbol)}`),
        fetch(`/api/culture?symbol=${encodeURIComponent(symbol)}`),
      ]);
      const data = await chartRes.json();
      if (!chartRes.ok) throw new Error(data.error || "Could not load chart");
      if (
        typeof data.yearHigh !== "number" ||
        typeof data.currentPrice !== "number" ||
        !Array.isArray(data.prices)
      ) {
        throw new Error("Unexpected chart response");
      }
      if (loadId !== loadIdRef.current) return;
      setChart(data as ChartPayload);
      setQuery((current) => (current === queryAtStart ? "" : current));

      if (financialsRes.ok) {
        const financialsData = await financialsRes.json();
        if (Array.isArray(financialsData.points) && financialsData.points.length > 0) {
          setFinancials(financialsData as FinancialsPayload);
        } else {
          setFinancialsError("Financial data unavailable for this stock");
        }
      } else {
        const financialsData = await financialsRes.json().catch(() => ({}));
        setFinancialsError(
          (financialsData as { error?: string }).error ||
            "Financial data unavailable for this stock"
        );
      }

      if (revenueRes.ok) {
        const revenueData = await revenueRes.json();
        if (Array.isArray(revenueData.points) && revenueData.points.length > 0) {
          setRevenue(revenueData as RevenuePayload);
        } else {
          setRevenueError("Revenue data unavailable for this stock");
        }
      } else {
        const revenueData = await revenueRes.json().catch(() => ({}));
        setRevenueError(
          (revenueData as { error?: string }).error ||
            "Revenue data unavailable for this stock"
        );
      }

      if (marginsRes.ok) {
        const marginsData = await marginsRes.json();
        if (
          Array.isArray(marginsData.points) &&
          marginsData.points.length > 0 &&
          typeof marginsData.latestOperatingPercent === "number"
        ) {
          setMargins(marginsData as MarginsPayload);
        } else {
          setMarginsError("Margin data unavailable for this stock");
        }
      } else {
        const marginsData = await marginsRes.json().catch(() => ({}));
        setMarginsError(
          (marginsData as { error?: string }).error ||
            "Margin data unavailable for this stock"
        );
      }

      if (peRatioRes.ok) {
        const peRatioData = await peRatioRes.json();
        if (Array.isArray(peRatioData.points) && peRatioData.points.length > 0) {
          setPeRatio(peRatioData as PeRatioPayload);
        } else {
          setPeRatioError("P/E ratio data unavailable for this stock");
        }
      } else {
        const peRatioData = await peRatioRes.json().catch(() => ({}));
        setPeRatioError(
          (peRatioData as { error?: string }).error ||
            "P/E ratio data unavailable for this stock"
        );
      }

      if (scaleTestRes.ok) {
        const scaleTestData = await scaleTestRes.json();
        if (Array.isArray(scaleTestData.points) && scaleTestData.points.length > 0) {
          setScaleTest(scaleTestData as ScaleTestPayload);
        } else {
          setScaleTestError("Scale test data unavailable for this stock");
        }
      } else {
        const scaleTestData = await scaleTestRes.json().catch(() => ({}));
        setScaleTestError(
          (scaleTestData as { error?: string }).error ||
            "Scale test data unavailable for this stock"
        );
      }

      if (ceoRes.ok) {
        const ceoData = await ceoRes.json();
        if (ceoData.name && ceoData.description) {
          setCeo(ceoData as CeoPayload);
        } else {
          setCeoError("CEO information unavailable for this stock");
        }
      } else {
        const ceoData = await ceoRes.json().catch(() => ({}));
        setCeoError(
          (ceoData as { error?: string }).error ||
            "CEO information unavailable for this stock"
        );
      }

      if (shortInterestRes.ok) {
        const shortInterestData = await shortInterestRes.json();
        if (
          typeof shortInterestData.shortPercent === "number" ||
          typeof shortInterestData.institutionalPercent === "number"
        ) {
          setShortInterest(shortInterestData as ShortInterestPayload);
        } else {
          setShortInterestError("Market stats unavailable for this stock");
        }
      } else {
        const shortInterestData = await shortInterestRes.json().catch(() => ({}));
        setShortInterestError(
          (shortInterestData as { error?: string }).error ||
            "Market stats unavailable for this stock"
        );
      }

      if (benchmarkRes.ok) {
        const benchmarkData = await benchmarkRes.json();
        if (
          typeof benchmarkData.stockGrowthPercent === "number" &&
          typeof benchmarkData.sp500GrowthPercent === "number"
        ) {
          setBenchmark(benchmarkData as BenchmarkComparisonPayload);
        } else {
          setBenchmarkError("Benchmark data unavailable for this stock");
        }
      } else {
        const benchmarkData = await benchmarkRes.json().catch(() => ({}));
        setBenchmarkError(
          (benchmarkData as { error?: string }).error ||
            "Benchmark data unavailable for this stock"
        );
      }

      if (cultureRes.ok) {
        const cultureData = await cultureRes.json();
        if (cultureData.summary) {
          setCulture(cultureData as CultureMissionPayload);
        } else {
          setCultureError("Culture and mission data unavailable for this stock");
        }
      } else {
        const cultureData = await cultureRes.json().catch(() => ({}));
        setCultureError(
          (cultureData as { error?: string }).error ||
            "Culture and mission data unavailable for this stock"
        );
      }
    } catch (err) {
      if (loadId !== loadIdRef.current) return;
      setChart(null);
      setFinancials(null);
      setRevenue(null);
      setMargins(null);
      setPeRatio(null);
      setScaleTest(null);
      setCeo(null);
      setShortInterest(null);
      setBenchmark(null);
      setCulture(null);
      setError(err instanceof Error ? err.message : "Could not load chart");
    } finally {
      if (loadId === loadIdRef.current) {
        setLoadingChart(false);
      }
    }
  }

  async function changeChartRange(range: ChartRange) {
    if (!chart || range === chartRange) return;

    setChartRange(range);
    setLoadingPriceChart(true);
    try {
      const [chartRes, peRatioRes] = await Promise.all([
        fetch(`/api/chart?symbol=${encodeURIComponent(chart.symbol)}&range=${range}`),
        fetch(`/api/pe-ratio?symbol=${encodeURIComponent(chart.symbol)}&range=${range}`),
      ]);
      const data = await chartRes.json();
      if (!chartRes.ok) throw new Error(data.error || "Could not load chart");
      if (
        typeof data.yearHigh !== "number" ||
        typeof data.currentPrice !== "number" ||
        !Array.isArray(data.prices)
      ) {
        throw new Error("Unexpected chart response");
      }
      setChart(data as ChartPayload);

      if (peRatioRes.ok) {
        const peRatioData = await peRatioRes.json();
        if (Array.isArray(peRatioData.points) && peRatioData.points.length > 0) {
          setPeRatio(peRatioData as PeRatioPayload);
          setPeRatioError(null);
        } else {
          setPeRatio(null);
          setPeRatioError("P/E ratio data unavailable for this stock");
        }
      } else {
        const peRatioData = await peRatioRes.json().catch(() => ({}));
        setPeRatio(null);
        setPeRatioError(
          (peRatioData as { error?: string }).error ||
            "P/E ratio data unavailable for this stock"
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load chart");
    } finally {
      setLoadingPriceChart(false);
    }
  }

  async function resolveAndLoad(raw: string) {
    if (suggestions.length > 0) {
      const pick = suggestions[Math.min(activeIndex, suggestions.length - 1)];
      await loadChart(pick.symbol);
      return;
    }

    const trimmed = raw.split("—")[0].trim();
    if (!trimmed) return;

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      const results = (data.results as StockSuggestion[] | undefined) ?? [];
      const exact = results.find(
        (r) => r.symbol.toUpperCase() === trimmed.toUpperCase()
      );
      const first = exact ?? results[0];
      if (!first) {
        setError(`No stock found for "${trimmed}". Try another search.`);
        return;
      }
      await loadChart(first.symbol);
    } catch {
      setError("Could not search stocks");
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void resolveAndLoad(query);
  }

  const isDoubleDown = chart?.status === "double_down";
  const moat = chart
    ? buildMoatAnalysis({
        companyName: chart.name,
        financials,
        revenue,
        margins,
        scaleTest,
      })
    : null;
  const recession = chart
    ? buildRecessionAnalysis({
        companyName: chart.name,
        chart,
        financials,
        revenue,
        margins,
        sector: chart.sector,
        industry: chart.industry,
      })
    : null;
  const cashVsDebtScore = financials ? calculateCashVsDebtScore(financials) : null;
  const revenueGrowthScore = revenue ? calculateRevenueGrowthScore(revenue) : null;
  const operatingMarginScore = margins ? calculateOperatingMarginScore(margins) : null;
  const shortInterestScore = shortInterest
    ? calculateShortInterestScore(shortInterest)
    : null;
  const institutionalOwnershipScore = shortInterest
    ? calculateInstitutionalOwnershipScore(shortInterest)
    : null;
  const scalabilityTestScore = scaleTest ? calculateScalabilityTestScore(scaleTest) : null;
  const sp500ComparisonScore = benchmark ? calculateSp500ComparisonScore(benchmark) : null;
  const moatScore = chart
    ? calculateMoatScore({
        companyName: chart.name,
        financials,
        revenue,
        margins,
        scaleTest,
      })
    : null;
  const ceoScore =
    ceo && chart
      ? calculateCeoScore({
          ceo,
          revenue,
          moatScore: moatScore?.score ?? null,
        })
      : null;
  const recessionProofScore = chart
    ? calculateRecessionProofScore({
        companyName: chart.name,
        chart,
        financials,
        revenue,
        margins,
        sector: chart.sector,
        industry: chart.industry,
      })
    : null;
  const secularTrendScore = chart
    ? calculateSecularTrendScore({
        companyName: chart.name,
        sector: chart.sector,
        industry: chart.industry,
        revenue,
        benchmark,
      })
    : null;
  const cultureMissionScore = culture ? calculateCultureMissionScore(culture) : null;
  const talentScore = chart
    ? calculateTalentScore({
        companyName: chart.name,
        culture,
        sector: chart.sector,
        industry: chart.industry,
        revenue,
        margins,
        scaleTest,
      })
    : null;

  const scoreItems = [
    cashVsDebtScore,
    revenueGrowthScore,
    operatingMarginScore,
    shortInterestScore,
    institutionalOwnershipScore,
    scalabilityTestScore,
    sp500ComparisonScore,
    moatScore,
    ceoScore,
    recessionProofScore,
    secularTrendScore,
    cultureMissionScore,
    talentScore,
  ].filter((item) => item != null);
  const totalScore = scoreItems.reduce((sum, item) => sum + item.score, 0);
  const totalMaxScore = scoreItems.reduce((sum, item) => sum + item.maxScore, 0);

  return (
    <div>
      <form onSubmit={onSubmit}>
        <div ref={wrapRef} style={{ position: "relative" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            onKeyDown={(e) => {
              if (!open || suggestions.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIndex((i) => (i + 1) % suggestions.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIndex(
                  (i) => (i - 1 + suggestions.length) % suggestions.length
                );
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Type a stock name or symbol (e.g. Apple, AAPL)"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            style={{
              width: "100%",
              padding: "16px 18px",
              borderRadius: 12,
              border: "1px solid var(--line)",
              background: "var(--bg-soft)",
              color: "var(--text)",
              fontSize: "1.05rem",
              outline: "none",
              boxShadow: "0 0 0 3px transparent",
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.boxShadow =
                "0 0 0 3px rgba(61, 214, 198, 0.25)";
              e.currentTarget.style.borderColor = "var(--accent-dim)";
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.boxShadow = "0 0 0 3px transparent";
              e.currentTarget.style.borderColor = "var(--line)";
            }}
          />

          {open && (suggestions.length > 0 || loadingSearch) && (
            <ul
              role="listbox"
              style={{
                position: "absolute",
                zIndex: 20,
                top: "calc(100% + 8px)",
                left: 0,
                right: 0,
                margin: 0,
                padding: 6,
                listStyle: "none",
                background: "var(--bg-soft)",
                border: "1px solid var(--line)",
                borderRadius: 12,
                maxHeight: 280,
                overflowY: "auto",
                boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
              }}
            >
              {loadingSearch && suggestions.length === 0 && (
                <li style={{ padding: "12px 14px", color: "var(--muted)" }}>
                  Searching…
                </li>
              )}
              {suggestions.map((item, index) => (
                <li key={`${item.symbol}-${item.exchange}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => void loadChart(item.symbol)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      border: "none",
                      borderRadius: 8,
                      padding: "12px 14px",
                      cursor: "pointer",
                      background:
                        index === activeIndex
                          ? "rgba(61, 214, 198, 0.14)"
                          : "transparent",
                      color: "var(--text)",
                    }}
                  >
                    <div style={{ fontWeight: 650 }}>{item.symbol}</div>
                    <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                      {item.name}
                      {item.exchange ? ` · ${item.exchange}` : ""}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>

      {error && (
        <p style={{ marginTop: 16, color: "#ff8f8f" }} role="alert">
          {error}
        </p>
      )}

      {loadingChart && (
        <p style={{ marginTop: 24, color: "var(--muted)" }}>Loading chart…</p>
      )}

      {chart && !loadingChart && (
        <section style={{ marginTop: 32 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                style={{
                  margin: "0 0 4px",
                  fontSize: "1.35rem",
                  fontWeight: 650,
                }}
              >
                {chart.symbol}
                <span style={{ color: "var(--muted)", fontWeight: 500 }}>
                  {" "}
                  · {chart.name}
                </span>
              </h2>
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Weekly close prices · last year ({chart.currency})
              </p>
              <p
                style={{
                  margin: "12px 0 0",
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: isDoubleDown ? "#f0a04b" : "var(--text)",
                  lineHeight: 1.1,
                }}
              >
                {chart.currentPrice.toFixed(2)}{" "}
                <span
                  style={{
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: "var(--muted)",
                  }}
                >
                  {chart.currency}
                </span>
              </p>
            </div>

            <div
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: `1px solid ${isDoubleDown ? "rgba(240, 160, 75, 0.45)" : "rgba(61, 214, 198, 0.35)"}`,
                background: isDoubleDown
                  ? "rgba(240, 160, 75, 0.12)"
                  : "rgba(61, 214, 198, 0.1)",
                minWidth: 200,
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 4,
                }}
              >
                Current DCA status
              </div>
              <div
                style={{
                  fontSize: "1.2rem",
                  fontWeight: 700,
                  color: isDoubleDown ? "#f0a04b" : "var(--accent)",
                }}
              >
                {isDoubleDown ? "Double down" : "Normal"}
              </div>
              <div style={{ marginTop: 6, fontSize: "0.9rem", color: "var(--muted)" }}>
                Now {chart.currentPrice.toFixed(2)} ·{" "}
                {chart.dropPercent >= 0
                  ? `${chart.dropPercent}% below`
                  : `${Math.abs(chart.dropPercent)}% above`}{" "}
                year high ({chart.yearHigh.toFixed(2)})
              </div>
            </div>
          </div>

          <AnalysisTabBar active={analysisTab} onChange={setAnalysisTab} />

          {analysisTab === "price" && (
            <>
          <ChartRangeFilter
            active={chartRange}
            loading={loadingPriceChart}
            onChange={(range) => void changeChartRange(range)}
          />

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 12,
              fontSize: "0.9rem",
              color: "var(--muted)",
            }}
          >
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 0,
                  borderTop: `2px solid ${NORMAL_BAR}`,
                  marginRight: 6,
                  verticalAlign: "middle",
                }}
              />
              Price
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: DOUBLE_DOWN_BAR,
                  marginRight: 6,
                }}
              />
              Double down zone
            </span>
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: 18,
                  height: 0,
                  borderTop: `2px dashed ${YEAR_HIGH_LINE}`,
                  marginRight: 6,
                  verticalAlign: "middle",
                }}
              />
              Year high ({chart.yearHigh.toFixed(2)})
            </span>
            <span>Double down threshold: {chart.doubleDownPrice.toFixed(2)}</span>
          </div>

          <div
            style={{
              height: 380,
              width: "100%",
              padding: "12px 8px 8px",
              borderRadius: 16,
              border: "1px solid var(--line)",
              background: isDoubleDown
                ? "linear-gradient(180deg, rgba(240, 160, 75, 0.08), rgba(18, 26, 43, 0.75))"
                : "rgba(18, 26, 43, 0.75)",
              opacity: loadingPriceChart ? 0.65 : 1,
              transition: "opacity 0.15s ease",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chart.prices}
                margin={{ top: 24, right: 120, left: 0, bottom: 8 }}
              >
                <CartesianGrid stroke="rgba(147, 164, 195, 0.18)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#93a4c3", fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={28}
                  axisLine={{ stroke: "#243047" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#93a4c3", fontSize: 12 }}
                  width={56}
                  axisLine={false}
                  tickLine={false}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  cursor={{ stroke: "rgba(61, 214, 198, 0.35)", strokeWidth: 1 }}
                  content={(props) => (
                    <ChartTooltip {...props} currency={chart.currency} />
                  )}
                />
                <ReferenceLine
                  y={chart.yearHigh}
                  stroke={YEAR_HIGH_LINE}
                  strokeDasharray="6 4"
                  label={{
                    value: `Year high (${chart.yearHigh.toFixed(2)})`,
                    fill: YEAR_HIGH_LINE,
                    fontSize: 11,
                    position: "right",
                  }}
                />
                <ReferenceLine
                  y={chart.doubleDownPrice}
                  stroke="#f0a04b"
                  strokeDasharray="6 4"
                  label={{
                    value: "Double down (−20%)",
                    fill: "#f0a04b",
                    fontSize: 11,
                    position: "right",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="close"
                  stroke={NORMAL_BAR}
                  strokeWidth={2.5}
                  dot={
                    chartRange === "1d" || chartRange === "5d"
                      ? false
                      : (props) => {
                          const { cx, cy, payload, key } = props;
                          if (cx == null || cy == null || !payload) {
                            return <circle key={key} cx={0} cy={0} r={0} fill="none" />;
                          }
                          return (
                            <circle
                              key={key}
                              cx={cx}
                              cy={cy}
                              r={4}
                              fill={payload.doubleDown ? DOUBLE_DOWN_BAR : NORMAL_BAR}
                              stroke="none"
                            />
                          );
                        }
                  }
                  activeDot={{
                    r: 5,
                    fill: isDoubleDown ? DOUBLE_DOWN_BAR : NORMAL_BAR,
                    strokeWidth: 0,
                  }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {peRatio && (
            <div style={{ marginTop: 40 }}>
              <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.95rem" }}>
                Trailing P/E ratio (price ÷ TTM EPS)
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid rgba(129, 140, 248, 0.35)",
                    background: "rgba(129, 140, 248, 0.08)",
                    fontSize: "0.9rem",
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>Current P/E </span>
                  <strong style={{ color: PE_LINE }}>{peRatio.latestPe.toFixed(1)}x</strong>
                </div>
                {peRatio.trailingPe != null && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(61, 214, 198, 0.35)",
                      background: "rgba(61, 214, 198, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>Yahoo trailing P/E </span>
                    <strong style={{ color: MARGIN_LINE }}>
                      {peRatio.trailingPe.toFixed(1)}x
                    </strong>
                  </div>
                )}
              </div>

              <div
                style={{
                  height: 260,
                  width: "100%",
                  padding: "12px 8px 8px",
                  borderRadius: 16,
                  border: "1px solid var(--line)",
                  background: "rgba(18, 26, 43, 0.75)",
                  opacity: loadingPriceChart ? 0.65 : 1,
                  transition: "opacity 0.15s ease",
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={peRatio.points}
                    margin={{ top: 12, right: 44, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid
                      stroke="rgba(147, 164, 195, 0.18)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "#93a4c3", fontSize: 11 }}
                      interval="preserveStartEnd"
                      minTickGap={28}
                      axisLine={{ stroke: "#243047" }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: PE_LINE, fontSize: 11 }}
                      width={44}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value: number) => `${value.toFixed(0)}x`}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#121a2b",
                        border: "1px solid #243047",
                        borderRadius: 10,
                        color: "#e8eef9",
                      }}
                      labelStyle={{ color: "#93a4c3" }}
                      formatter={(value: number) => [`${value.toFixed(2)}x`, "P/E"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="pe"
                      name="P/E"
                      stroke={PE_LINE}
                      strokeWidth={2.5}
                      dot={
                        chartRange === "1d" || chartRange === "5d"
                          ? false
                          : { r: 4, fill: PE_LINE, strokeWidth: 0 }
                      }
                      activeDot={{ r: 5, fill: PE_LINE, strokeWidth: 0 }}
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!peRatio && peRatioError && (
            <p
              style={{
                margin: "40px 0 0",
                color: "var(--muted)",
                fontSize: "0.95rem",
              }}
            >
              {peRatioError}
            </p>
          )}
            </>
          )}

          {analysisTab === "insights" && (
            <>
            {moat && (
              <div
                style={{
                  marginBottom: 28,
                  padding: "16px 18px",
                  borderRadius: 16,
                  border: `1px solid ${
                    moat.strength === "Strong"
                      ? "rgba(61, 214, 198, 0.35)"
                      : moat.strength === "Moderate"
                        ? "rgba(251, 191, 36, 0.35)"
                        : "rgba(255, 123, 123, 0.35)"
                  }`,
                  background: "rgba(18, 26, 43, 0.75)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 650,
                      color: "var(--text)",
                    }}
                  >
                    Competitive moat
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color:
                        moat.strength === "Strong"
                          ? "var(--accent)"
                          : moat.strength === "Moderate"
                            ? MARGIN_BAR
                            : OPEX_GROWTH,
                      background:
                        moat.strength === "Strong"
                          ? "rgba(61, 214, 198, 0.12)"
                          : moat.strength === "Moderate"
                            ? "rgba(251, 191, 36, 0.12)"
                            : "rgba(255, 123, 123, 0.12)",
                    }}
                  >
                    {moat.strength}
                  </span>
                </div>
                <p
                  style={{
                    margin: "0 0 14px",
                    color: "var(--muted)",
                    fontSize: "0.95rem",
                    lineHeight: 1.55,
                  }}
                >
                  {moat.summary}
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  }}
                >
                  {moat.signals.map((signal) => (
                    <div
                      key={signal.label}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: "rgba(11, 18, 32, 0.55)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 650,
                          color: moatStatusColor(signal.status),
                          marginBottom: 4,
                          textTransform: "capitalize",
                        }}
                      >
                        {signal.label} · {signal.status}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--muted)",
                          lineHeight: 1.45,
                        }}
                      >
                        {signal.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recession && (
              <div
                style={{
                  marginBottom: 28,
                  padding: "16px 18px",
                  borderRadius: 16,
                  border: `1px solid ${
                    recession.isRecessionProof
                      ? "rgba(61, 214, 198, 0.35)"
                      : recession.rating === "Mixed"
                        ? "rgba(251, 191, 36, 0.35)"
                        : "rgba(255, 123, 123, 0.35)"
                  }`,
                  background: "rgba(18, 26, 43, 0.75)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 650,
                      color: "var(--text)",
                    }}
                  >
                    Recession proof
                  </span>
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: recession.isRecessionProof
                        ? "var(--accent)"
                        : recession.rating === "Mixed"
                          ? MARGIN_BAR
                          : OPEX_GROWTH,
                      background: recession.isRecessionProof
                        ? "rgba(61, 214, 198, 0.12)"
                        : recession.rating === "Mixed"
                          ? "rgba(251, 191, 36, 0.12)"
                          : "rgba(255, 123, 123, 0.12)",
                    }}
                  >
                    {recession.isRecessionProof ? "Yes" : recession.rating}
                  </span>
                </div>
                <p
                  style={{
                    margin: "0 0 14px",
                    color: "var(--muted)",
                    fontSize: "0.95rem",
                    lineHeight: 1.55,
                  }}
                >
                  {recession.summary}
                </p>
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  }}
                >
                  {recession.signals.map((signal) => (
                    <div
                      key={signal.label}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: "rgba(11, 18, 32, 0.55)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 650,
                          color: recessionStatusColor(signal.status),
                          marginBottom: 4,
                          textTransform: "capitalize",
                        }}
                      >
                        {signal.label} · {signal.status}
                      </div>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--muted)",
                          lineHeight: 1.45,
                        }}
                      >
                        {signal.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ceo && (
              <div
                style={{
                  marginBottom: 28,
                  padding: "16px 18px",
                  borderRadius: 16,
                  border: "1px solid var(--line)",
                  background: "rgba(18, 26, 43, 0.75)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 650,
                    color: "var(--text)",
                    marginBottom: 8,
                  }}
                >
                  CEO
                </div>
                <div
                  style={{
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: "var(--accent)",
                    marginBottom: 4,
                  }}
                >
                  {ceo.name}
                  {ceo.since ? (
                    <span style={{ color: "var(--muted)", fontWeight: 500 }}>
                      {" "}
                      · since {ceo.since}
                    </span>
                  ) : null}
                </div>
                <div
                  style={{
                    fontSize: "0.85rem",
                    color: "var(--muted)",
                    marginBottom: 10,
                  }}
                >
                  {ceo.title} · {ceo.companyName}
                </div>
                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: "0.95rem",
                    lineHeight: 1.55,
                  }}
                >
                  {ceo.description}
                </p>
              </div>
            )}

            {!ceo && ceoError && (
              <p
                style={{
                  margin: "0 0 28px",
                  color: "var(--muted)",
                  fontSize: "0.95rem",
                }}
              >
                {ceoError}
              </p>
            )}
            </>
          )}

          {analysisTab === "score" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {scoreItems.length > 0 ? (
                <div
                  style={{
                    padding: "18px 20px",
                    borderRadius: 16,
                    border: "1px solid rgba(61, 214, 198, 0.35)",
                    background: "rgba(61, 214, 198, 0.08)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 650,
                      color: "var(--text)",
                      marginBottom: 6,
                    }}
                  >
                    Total score
                  </div>
                  <div
                    style={{
                      fontSize: "2rem",
                      fontWeight: 700,
                      color: "var(--accent)",
                      lineHeight: 1.1,
                    }}
                  >
                    {totalScore}
                    <span
                      style={{
                        fontSize: "1rem",
                        fontWeight: 500,
                        color: "var(--muted)",
                      }}
                    >
                      {" "}
                      / {totalMaxScore}
                    </span>
                  </div>
                  <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "0.9rem" }}>
                    {scoreItems.length} metrics scored · scroll for breakdown
                  </p>
                </div>
              ) : (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  Loading scores… If nothing appears, hard-refresh the page.
                </p>
              )}

              {cashVsDebtScore && financials && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Cash vs debt
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          cashVsDebtScore.score >= 19
                            ? "var(--accent)"
                            : cashVsDebtScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {cashVsDebtScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {cashVsDebtScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(79, 140, 255, 0.35)",
                        background: "rgba(79, 140, 255, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Cash ratio </span>
                      <strong style={{ color: NORMAL_BAR }}>
                        {formatCashRatio(cashVsDebtScore.cashRatio)}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(61, 214, 198, 0.35)",
                        background: "rgba(61, 214, 198, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Cash </span>
                      <strong style={{ color: CASH_BAR }}>
                        {formatBillions(financials.latestCash)}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(255, 123, 123, 0.35)",
                        background: "rgba(255, 123, 123, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Debt </span>
                      <strong style={{ color: DEBT_BAR }}>
                        {formatBillions(financials.latestDebt)}
                      </strong>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {cashVsDebtScore.explanation}
                  </p>
                </div>
              )}

              {revenueGrowthScore && revenue && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Revenue growth
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          revenueGrowthScore.score >= 10
                            ? "var(--accent)"
                            : revenueGrowthScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {revenueGrowthScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {revenueGrowthScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(79, 140, 255, 0.35)",
                        background: "rgba(79, 140, 255, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>3Y avg growth </span>
                      <strong style={{ color: REVENUE_BAR }}>
                        {formatGrowth(revenueGrowthScore.averageGrowthPercent)}
                      </strong>
                    </div>
                    {revenueGrowthScore.yearlyGrowth.map((point) => (
                      <div
                        key={point.year}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--line)",
                          background: "rgba(18, 26, 43, 0.75)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>{point.year} </span>
                        <strong style={{ color: REVENUE_BAR }}>
                          {formatGrowth(point.growthPercent)}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {revenueGrowthScore.explanation}
                  </p>
                </div>
              )}

              {operatingMarginScore && margins && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Operating margin
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          operatingMarginScore.score >= 10
                            ? "var(--accent)"
                            : operatingMarginScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {operatingMarginScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {operatingMarginScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(79, 140, 255, 0.35)",
                        background: "rgba(79, 140, 255, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Operating margin </span>
                      <strong style={{ color: MARGIN_BAR }}>
                        {operatingMarginScore.operatingMarginPercent.toFixed(1)}%
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: "rgba(18, 26, 43, 0.75)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Operating income </span>
                      <strong style={{ color: "var(--text)" }}>
                        {typeof margins.latestOperatingAmount === "number"
                          ? formatBillions(margins.latestOperatingAmount)
                          : "N/A"}
                      </strong>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {operatingMarginScore.explanation}
                  </p>
                </div>
              )}

              {shortInterestScore && shortInterest && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Short interest
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          shortInterestScore.score >= 10
                            ? "var(--accent)"
                            : shortInterestScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {shortInterestScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {shortInterestScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(79, 140, 255, 0.35)",
                        background: "rgba(79, 140, 255, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Short interest </span>
                      <strong style={{ color: NORMAL_BAR }}>
                        {shortInterestScore.shortPercent.toFixed(1)}%
                      </strong>
                    </div>
                    {shortInterest.shortRatio != null && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--line)",
                          background: "rgba(18, 26, 43, 0.75)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>Short ratio </span>
                        <strong style={{ color: "var(--text)" }}>
                          {shortInterest.shortRatio.toFixed(2)}
                        </strong>
                      </div>
                    )}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {shortInterestScore.explanation}
                  </p>
                </div>
              )}

              {institutionalOwnershipScore && shortInterest && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Institutional ownership
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          institutionalOwnershipScore.score >= 10
                            ? "var(--accent)"
                            : institutionalOwnershipScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {institutionalOwnershipScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {institutionalOwnershipScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(79, 140, 255, 0.35)",
                        background: "rgba(79, 140, 255, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Institutional </span>
                      <strong style={{ color: NORMAL_BAR }}>
                        {institutionalOwnershipScore.institutionalPercent.toFixed(1)}%
                      </strong>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {institutionalOwnershipScore.explanation}
                  </p>
                </div>
              )}

              {scalabilityTestScore && scaleTest && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Scalability test
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color: scalabilityTestScore.score >= 10
                          ? "var(--accent)"
                          : OPEX_GROWTH,
                      }}
                    >
                      {scalabilityTestScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {scalabilityTestScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(167, 139, 250, 0.35)",
                        background: "rgba(167, 139, 250, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Revenue growth </span>
                      <strong style={{ color: REVENUE_BAR }}>
                        {formatGrowth(scalabilityTestScore.revenueGrowth)}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(255, 123, 123, 0.35)",
                        background: "rgba(255, 123, 123, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>OpEx growth </span>
                      <strong style={{ color: OPEX_GROWTH }}>
                        {formatGrowth(scalabilityTestScore.opexGrowth)}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1px solid ${scalabilityTestScore.passed ? "rgba(61, 214, 198, 0.45)" : "rgba(255, 123, 123, 0.45)"}`,
                        background: scalabilityTestScore.passed
                          ? "rgba(61, 214, 198, 0.08)"
                          : "rgba(255, 123, 123, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Result </span>
                      <strong
                        style={{
                          color: scalabilityTestScore.passed
                            ? "var(--accent)"
                            : OPEX_GROWTH,
                        }}
                      >
                        {scalabilityTestScore.passed ? "Pass" : "Fail"}
                      </strong>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {scalabilityTestScore.explanation}
                  </p>
                </div>
              )}

              {sp500ComparisonScore && benchmark && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      vs S&P 500 (5Y)
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          sp500ComparisonScore.score >= 10
                            ? "var(--accent)"
                            : sp500ComparisonScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {sp500ComparisonScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {sp500ComparisonScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(79, 140, 255, 0.35)",
                        background: "rgba(79, 140, 255, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Stock 5Y </span>
                      <strong style={{ color: NORMAL_BAR }}>
                        {formatGrowth(sp500ComparisonScore.stockGrowthPercent)}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid var(--line)",
                        background: "rgba(18, 26, 43, 0.75)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>S&P 500 5Y </span>
                      <strong style={{ color: "var(--text)" }}>
                        {formatGrowth(sp500ComparisonScore.sp500GrowthPercent)}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1px solid ${sp500ComparisonScore.outperformancePercent >= 0 ? "rgba(61, 214, 198, 0.45)" : "rgba(255, 123, 123, 0.45)"}`,
                        background:
                          sp500ComparisonScore.outperformancePercent >= 0
                            ? "rgba(61, 214, 198, 0.08)"
                            : "rgba(255, 123, 123, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>vs S&P </span>
                      <strong
                        style={{
                          color:
                            sp500ComparisonScore.outperformancePercent >= 0
                              ? "var(--accent)"
                              : OPEX_GROWTH,
                        }}
                      >
                        {formatGrowth(sp500ComparisonScore.outperformancePercent)}
                      </strong>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {sp500ComparisonScore.explanation}
                  </p>
                </div>
              )}

              {moatScore && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Moat test
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          moatScore.score >= 8
                            ? "var(--accent)"
                            : moatScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {moatScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {moatScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1px solid ${moatScore.strength === "Strong" ? "rgba(61, 214, 198, 0.45)" : moatScore.strength === "Moderate" ? "rgba(251, 191, 36, 0.45)" : "rgba(255, 123, 123, 0.45)"}`,
                        background:
                          moatScore.strength === "Strong"
                            ? "rgba(61, 214, 198, 0.08)"
                            : moatScore.strength === "Moderate"
                              ? "rgba(251, 191, 36, 0.08)"
                              : "rgba(255, 123, 123, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Moat strength </span>
                      <strong
                        style={{
                          color:
                            moatScore.strength === "Strong"
                              ? "var(--accent)"
                              : moatScore.strength === "Moderate"
                                ? MARGIN_BAR
                                : OPEX_GROWTH,
                        }}
                      >
                        {moatScore.strength}
                      </strong>
                    </div>
                    {moatScore.signals.map((signal) => (
                      <div
                        key={signal.label}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--line)",
                          background: "rgba(18, 26, 43, 0.75)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>{signal.label} </span>
                        <strong style={{ color: moatStatusColor(signal.status) }}>
                          {signal.status}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {moatScore.explanation}
                  </p>
                </div>
              )}

              {ceoScore && ceo && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      CEO test
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          ceoScore.score >= 8
                            ? "var(--accent)"
                            : ceoScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {ceoScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {ceoScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: "1px solid rgba(79, 140, 255, 0.35)",
                        background: "rgba(79, 140, 255, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>CEO </span>
                      <strong style={{ color: NORMAL_BAR }}>{ceo.name}</strong>
                    </div>
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1px solid ${ceoScore.rating === "Strong" ? "rgba(61, 214, 198, 0.45)" : ceoScore.rating === "Moderate" ? "rgba(251, 191, 36, 0.45)" : "rgba(255, 123, 123, 0.45)"}`,
                        background:
                          ceoScore.rating === "Strong"
                            ? "rgba(61, 214, 198, 0.08)"
                            : ceoScore.rating === "Moderate"
                              ? "rgba(251, 191, 36, 0.08)"
                              : "rgba(255, 123, 123, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Rating </span>
                      <strong
                        style={{
                          color:
                            ceoScore.rating === "Strong"
                              ? "var(--accent)"
                              : ceoScore.rating === "Moderate"
                                ? MARGIN_BAR
                                : OPEX_GROWTH,
                        }}
                      >
                        {ceoScore.rating}
                      </strong>
                    </div>
                    {ceoScore.signals.map((signal) => (
                      <div
                        key={signal.label}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--line)",
                          background: "rgba(18, 26, 43, 0.75)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>{signal.label} </span>
                        <strong style={{ color: ceoStatusColor(signal.status) }}>
                          {signal.status}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {ceoScore.explanation}
                  </p>
                </div>
              )}

              {recessionProofScore && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Recession proof
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          recessionProofScore.score >= 5
                            ? "var(--accent)"
                            : OPEX_GROWTH,
                      }}
                    >
                      {recessionProofScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {recessionProofScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1px solid ${recessionProofScore.score >= 5 ? "rgba(61, 214, 198, 0.45)" : "rgba(255, 123, 123, 0.45)"}`,
                        background:
                          recessionProofScore.score >= 5
                            ? "rgba(61, 214, 198, 0.08)"
                            : "rgba(255, 123, 123, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Rating </span>
                      <strong
                        style={{
                          color:
                            recessionProofScore.score >= 5
                              ? "var(--accent)"
                              : OPEX_GROWTH,
                        }}
                      >
                        {recessionProofScore.rating}
                      </strong>
                    </div>
                    {recessionProofScore.signals.map((signal) => (
                      <div
                        key={signal.label}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--line)",
                          background: "rgba(18, 26, 43, 0.75)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>{signal.label} </span>
                        <strong style={{ color: recessionStatusColor(signal.status) }}>
                          {signal.status}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {recessionProofScore.explanation}
                  </p>
                </div>
              )}

              {secularTrendScore && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Secular trend test
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          secularTrendScore.score >= 8
                            ? "var(--accent)"
                            : secularTrendScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {secularTrendScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {secularTrendScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1px solid ${secularTrendScore.rating === "Strong" ? "rgba(61, 214, 198, 0.45)" : secularTrendScore.rating === "Moderate" ? "rgba(251, 191, 36, 0.45)" : "rgba(255, 123, 123, 0.45)"}`,
                        background:
                          secularTrendScore.rating === "Strong"
                            ? "rgba(61, 214, 198, 0.08)"
                            : secularTrendScore.rating === "Moderate"
                              ? "rgba(251, 191, 36, 0.08)"
                              : "rgba(255, 123, 123, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Trend </span>
                      <strong
                        style={{
                          color:
                            secularTrendScore.rating === "Strong"
                              ? "var(--accent)"
                              : secularTrendScore.rating === "Moderate"
                                ? MARGIN_BAR
                                : OPEX_GROWTH,
                        }}
                      >
                        {secularTrendScore.rating}
                      </strong>
                    </div>
                    {secularTrendScore.signals.map((signal) => (
                      <div
                        key={signal.label}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--line)",
                          background: "rgba(18, 26, 43, 0.75)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>{signal.label} </span>
                        <strong style={{ color: secularTrendStatusColor(signal.status) }}>
                          {signal.status}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {secularTrendScore.explanation}
                  </p>
                </div>
              )}

              {cultureMissionScore && culture && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Culture / mission
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          cultureMissionScore.score >= 8
                            ? "var(--accent)"
                            : cultureMissionScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {cultureMissionScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {cultureMissionScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1px solid ${cultureMissionScore.rating === "Strong" ? "rgba(61, 214, 198, 0.45)" : cultureMissionScore.rating === "Moderate" ? "rgba(251, 191, 36, 0.45)" : "rgba(255, 123, 123, 0.45)"}`,
                        background:
                          cultureMissionScore.rating === "Strong"
                            ? "rgba(61, 214, 198, 0.08)"
                            : cultureMissionScore.rating === "Moderate"
                              ? "rgba(251, 191, 36, 0.08)"
                              : "rgba(255, 123, 123, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Culture </span>
                      <strong
                        style={{
                          color:
                            cultureMissionScore.rating === "Strong"
                              ? "var(--accent)"
                              : cultureMissionScore.rating === "Moderate"
                                ? MARGIN_BAR
                                : OPEX_GROWTH,
                        }}
                      >
                        {cultureMissionScore.rating}
                      </strong>
                    </div>
                    {cultureMissionScore.signals.map((signal) => (
                      <div
                        key={signal.label}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--line)",
                          background: "rgba(18, 26, 43, 0.75)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>{signal.label} </span>
                        <strong style={{ color: cultureMissionStatusColor(signal.status) }}>
                          {signal.status}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {cultureMissionScore.explanation}
                  </p>
                </div>
              )}

              {talentScore && (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.95rem",
                        fontWeight: 650,
                        color: "var(--text)",
                      }}
                    >
                      Talent score
                    </div>
                    <div
                      style={{
                        fontSize: "1.4rem",
                        fontWeight: 700,
                        color:
                          talentScore.score >= 8
                            ? "var(--accent)"
                            : talentScore.score >= 5
                              ? MARGIN_BAR
                              : OPEX_GROWTH,
                      }}
                    >
                      {talentScore.score}
                      <span
                        style={{
                          fontSize: "0.95rem",
                          fontWeight: 500,
                          color: "var(--muted)",
                        }}
                      >
                        {" "}
                        / {talentScore.maxScore}
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 12,
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        border: `1px solid ${talentScore.rating === "Strong" ? "rgba(61, 214, 198, 0.45)" : talentScore.rating === "Moderate" ? "rgba(251, 191, 36, 0.45)" : "rgba(255, 123, 123, 0.45)"}`,
                        background:
                          talentScore.rating === "Strong"
                            ? "rgba(61, 214, 198, 0.08)"
                            : talentScore.rating === "Moderate"
                              ? "rgba(251, 191, 36, 0.08)"
                              : "rgba(255, 123, 123, 0.08)",
                        fontSize: "0.9rem",
                      }}
                    >
                      <span style={{ color: "var(--muted)" }}>Talent </span>
                      <strong
                        style={{
                          color:
                            talentScore.rating === "Strong"
                              ? "var(--accent)"
                              : talentScore.rating === "Moderate"
                                ? MARGIN_BAR
                                : OPEX_GROWTH,
                        }}
                      >
                        {talentScore.rating}
                      </strong>
                    </div>
                    {talentScore.signals.map((signal) => (
                      <div
                        key={signal.label}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid var(--line)",
                          background: "rgba(18, 26, 43, 0.75)",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>{signal.label} </span>
                        <strong style={{ color: talentStatusColor(signal.status) }}>
                          {signal.status}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "0.95rem",
                      lineHeight: 1.55,
                    }}
                  >
                    {talentScore.explanation}
                  </p>
                </div>
              )}

              {!financials && financialsError && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  {financialsError}
                </p>
              )}

              {!revenue && revenueError && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  {revenueError}
                </p>
              )}

              {!margins && marginsError && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  {marginsError}
                </p>
              )}

              {!shortInterest && shortInterestError && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  {shortInterestError}
                </p>
              )}

              {!scaleTest && scaleTestError && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  {scaleTestError}
                </p>
              )}

              {!benchmark && benchmarkError && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  {benchmarkError}
                </p>
              )}

              {!ceo && ceoError && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  {ceoError}
                </p>
              )}

              {!culture && cultureError && (
                <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                  {cultureError}
                </p>
              )}
            </div>
          )}

          {analysisTab === "financials" && (
            <>
            <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.95rem" }}>
              Debt vs cash · quarterly ({financials?.currency ?? chart.currency})
            </p>

            {financials && (
              <>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(61, 214, 198, 0.35)",
                      background: "rgba(61, 214, 198, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>Latest cash </span>
                    <strong style={{ color: CASH_BAR }}>
                      {formatBillions(financials.latestCash)}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(255, 123, 123, 0.35)",
                      background: "rgba(255, 123, 123, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>Latest debt </span>
                    <strong style={{ color: DEBT_BAR }}>
                      {formatBillions(financials.latestDebt)}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid var(--line)",
                      background: "rgba(18, 26, 43, 0.75)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>Net debt </span>
                    <strong style={{ color: "var(--text)" }}>
                      {formatBillions(financials.netDebt)}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(79, 140, 255, 0.35)",
                      background: "rgba(79, 140, 255, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>Cash/debt ratio </span>
                    <strong style={{ color: NORMAL_BAR }}>
                      {formatCashToDebtRatio(financials)}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    height: 260,
                    width: "100%",
                    padding: "12px 8px 8px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={withRatio(financials.points)}
                      margin={{ top: 12, right: 44, left: 0, bottom: 8 }}
                      barCategoryGap="28%"
                    >
                      <CartesianGrid
                        stroke="rgba(147, 164, 195, 0.18)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="period"
                        tick={{ fill: "#93a4c3", fontSize: 11 }}
                        axisLine={{ stroke: "#243047" }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="amount"
                        tick={{ fill: "#93a4c3", fontSize: 11 }}
                        width={56}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) => formatBillions(value)}
                      />
                      <YAxis
                        yAxisId="ratio"
                        orientation="right"
                        tick={{ fill: NORMAL_BAR, fontSize: 11 }}
                        width={40}
                        axisLine={false}
                        tickLine={false}
                        domain={ratioAxisDomain(withRatio(financials.points))}
                        tickFormatter={(value: number) => value.toFixed(2)}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(61, 214, 198, 0.08)" }}
                        content={(props) => (
                          <FinancialsTooltip
                            {...props}
                            currency={financials.currency}
                          />
                        )}
                      />
                      <Legend
                        wrapperStyle={{ color: "#93a4c3", fontSize: "0.85rem" }}
                        formatter={(value) => {
                          if (value === "cash") return "Cash";
                          if (value === "debt") return "Debt";
                          if (value === "ratio") return "Cash/debt ratio";
                          return value;
                        }}
                      />
                      <Bar
                        yAxisId="amount"
                        dataKey="cash"
                        name="cash"
                        fill={CASH_BAR}
                        barSize={22}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        yAxisId="amount"
                        dataKey="debt"
                        name="debt"
                        fill={DEBT_BAR}
                        barSize={22}
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="ratio"
                        type="monotone"
                        dataKey="ratio"
                        name="ratio"
                        stroke={NORMAL_BAR}
                        strokeWidth={2.5}
                        dot={{ r: 5, fill: NORMAL_BAR, strokeWidth: 0 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {!financials && financialsError && (
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.95rem" }}>
                {financialsError}
              </p>
            )}

            {revenue && (
              <div style={{ marginTop: 40 }}>
                <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.95rem" }}>
                  Revenue growth by year ({revenue.currency})
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(167, 139, 250, 0.35)",
                      background: "rgba(167, 139, 250, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>Latest revenue </span>
                    <strong style={{ color: REVENUE_BAR }}>
                      {formatBillions(revenue.latestRevenue)}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(61, 214, 198, 0.35)",
                      background: "rgba(61, 214, 198, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>YoY growth </span>
                    <strong style={{ color: GROWTH_LINE }}>
                      {formatGrowth(revenue.latestGrowthPercent)}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    height: 320,
                    width: "100%",
                    padding: "12px 8px 8px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={revenue.points}
                      margin={{ top: 12, right: 48, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid
                        stroke="rgba(147, 164, 195, 0.18)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="year"
                        tick={{ fill: "#93a4c3", fontSize: 11 }}
                        axisLine={{ stroke: "#243047" }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="revenue"
                        tick={{ fill: "#93a4c3", fontSize: 11 }}
                        width={56}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) => formatBillions(value)}
                      />
                      <YAxis
                        yAxisId="growth"
                        orientation="right"
                        tick={{ fill: GROWTH_LINE, fontSize: 11 }}
                        width={44}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(167, 139, 250, 0.08)" }}
                        content={(props) => (
                          <RevenueTooltip
                            {...props}
                            currency={revenue.currency}
                          />
                        )}
                      />
                      <Legend
                        wrapperStyle={{ color: "#93a4c3", fontSize: "0.85rem" }}
                        formatter={(value) => {
                          if (value === "revenue") return "Revenue";
                          if (value === "growthPercent") return "YoY growth";
                          return value;
                        }}
                      />
                      <Bar
                        yAxisId="revenue"
                        dataKey="revenue"
                        name="revenue"
                        fill={REVENUE_BAR}
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="growth"
                        type="monotone"
                        dataKey="growthPercent"
                        name="growthPercent"
                        stroke={GROWTH_LINE}
                        strokeWidth={2}
                        dot={{ r: 4, fill: GROWTH_LINE, strokeWidth: 0 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {!revenue && revenueError && (
              <p
                style={{
                  margin: "40px 0 0",
                  color: "var(--muted)",
                  fontSize: "0.95rem",
                }}
              >
                {revenueError}
              </p>
            )}

            {margins && (
              <div style={{ marginTop: 40 }}>
                <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.95rem" }}>
                  Net margin by year ({margins.currency})
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(251, 191, 36, 0.35)",
                      background: "rgba(251, 191, 36, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>Latest net income </span>
                    <strong style={{ color: MARGIN_BAR }}>
                      {formatBillions(margins.latestAmount)}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(61, 214, 198, 0.35)",
                      background: "rgba(61, 214, 198, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>Net margin </span>
                    <strong style={{ color: MARGIN_LINE }}>
                      {margins.latestPercent.toFixed(1)}%
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    height: 260,
                    width: "100%",
                    padding: "12px 8px 8px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={margins.points}
                      margin={{ top: 12, right: 44, left: 0, bottom: 8 }}
                      barCategoryGap="28%"
                    >
                      <CartesianGrid
                        stroke="rgba(147, 164, 195, 0.18)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="year"
                        tick={{ fill: "#93a4c3", fontSize: 11 }}
                        axisLine={{ stroke: "#243047" }}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="amount"
                        tick={{ fill: "#93a4c3", fontSize: 11 }}
                        width={56}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value: number) => formatBillions(value)}
                      />
                      <YAxis
                        yAxisId="percent"
                        orientation="right"
                        tick={{ fill: MARGIN_LINE, fontSize: 11 }}
                        width={44}
                        axisLine={false}
                        tickLine={false}
                        domain={percentAxisDomain(
                          margins.points.map((point) => point.percent)
                        )}
                        tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(251, 191, 36, 0.08)" }}
                        content={(props) => (
                          <MarginTooltip {...props} currency={margins.currency} />
                        )}
                      />
                      <Legend
                        wrapperStyle={{ color: "#93a4c3", fontSize: "0.85rem" }}
                        formatter={(value) => {
                          if (value === "amount") return "Net income";
                          if (value === "percent") return "Net margin %";
                          return value;
                        }}
                      />
                      <Bar
                        yAxisId="amount"
                        dataKey="amount"
                        name="amount"
                        fill={MARGIN_BAR}
                        barSize={28}
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        yAxisId="percent"
                        type="monotone"
                        dataKey="percent"
                        name="percent"
                        stroke={MARGIN_LINE}
                        strokeWidth={2.5}
                        dot={{ r: 5, fill: MARGIN_LINE, strokeWidth: 0 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {!margins && marginsError && (
              <p
                style={{
                  margin: "40px 0 0",
                  color: "var(--muted)",
                  fontSize: "0.95rem",
                }}
              >
                {marginsError}
              </p>
            )}

            {scaleTest && (
              <div style={{ marginTop: 40 }}>
                <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "0.95rem" }}>
                  Revenue growth vs operating expenses · scale test
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(167, 139, 250, 0.35)",
                      background: "rgba(167, 139, 250, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>Revenue growth </span>
                    <strong style={{ color: REVENUE_BAR }}>
                      {formatGrowth(scaleTest.latestRevenueGrowth)}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(255, 123, 123, 0.35)",
                      background: "rgba(255, 123, 123, 0.08)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>OpEx growth </span>
                    <strong style={{ color: OPEX_GROWTH }}>
                      {formatGrowth(scaleTest.latestOpexGrowth)}
                    </strong>
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: `1px solid ${scaleTest.scaleTestPassed ? "rgba(61, 214, 198, 0.45)" : "rgba(255, 123, 123, 0.45)"}`,
                      background: scaleTest.scaleTestPassed
                        ? "rgba(61, 214, 198, 0.1)"
                        : "rgba(255, 123, 123, 0.1)",
                      fontSize: "0.9rem",
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>Scale test </span>
                    <strong
                      style={{
                        color: scaleTest.scaleTestPassed ? "var(--accent)" : OPEX_GROWTH,
                      }}
                    >
                      {scaleTest.scaleTestPassed ? "Pass" : "Fail"}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    height: 260,
                    width: "100%",
                    padding: "12px 8px 8px",
                    borderRadius: 16,
                    border: "1px solid var(--line)",
                    background: "rgba(18, 26, 43, 0.75)",
                  }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={scaleTest.points}
                      margin={{ top: 12, right: 16, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid
                        stroke="rgba(147, 164, 195, 0.18)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="year"
                        tick={{ fill: "#93a4c3", fontSize: 11 }}
                        axisLine={{ stroke: "#243047" }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: "#93a4c3", fontSize: 11 }}
                        width={48}
                        axisLine={false}
                        tickLine={false}
                        domain={growthAxisDomain(scaleTest.points)}
                        tickFormatter={(value: number) => `${value.toFixed(0)}%`}
                      />
                      <Tooltip
                        cursor={{ stroke: "rgba(147, 164, 195, 0.25)" }}
                        content={(props) => <ScaleTestTooltip {...props} />}
                      />
                      <Legend
                        wrapperStyle={{ color: "#93a4c3", fontSize: "0.85rem" }}
                        formatter={(value) => {
                          if (value === "revenueGrowth") return "Revenue growth";
                          if (value === "opexGrowth") return "OpEx growth";
                          return value;
                        }}
                      />
                      <ReferenceLine
                        y={0}
                        stroke="#93a4c3"
                        strokeDasharray="4 4"
                      />
                      <Line
                        type="monotone"
                        dataKey="revenueGrowth"
                        name="revenueGrowth"
                        stroke={REVENUE_BAR}
                        strokeWidth={2.5}
                        dot={{ r: 5, fill: REVENUE_BAR, strokeWidth: 0 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="opexGrowth"
                        name="opexGrowth"
                        stroke={OPEX_GROWTH}
                        strokeWidth={2.5}
                        dot={{ r: 5, fill: OPEX_GROWTH, strokeWidth: 0 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {!scaleTest && scaleTestError && (
              <p
                style={{
                  margin: "40px 0 0",
                  color: "var(--muted)",
                  fontSize: "0.95rem",
                }}
              >
                {scaleTestError}
              </p>
            )}
            </>
          )}
        </section>
      )}
    </div>
  );
}
