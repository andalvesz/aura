import type { RevenueForecast, RevenueMetric, Json } from "@/types/database";

export type RevenueRegisterInput = {
  operationId?: string | null;
  productId?: string | null;
  platform?: string | null;
  country?: string | null;
  currency?: string | null;
  revenue?: number | null;
  spend?: number | null;
  profit?: number | null;
  roas?: number | null;
  roi?: number | null;
  conversions?: number | null;
  clicks?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpa?: number | null;
  date?: string | null;
  metadata?: Json;
};

export type RevenueBestCard = {
  label: string;
  value: number;
  currency: string;
  roas: number | null;
  roi: number | null;
};

export type RevenueChartPoint = {
  label: string;
  value: number;
  pct: number;
};

export type RevenueInsight = {
  id: string;
  title: string;
  summary: string;
  priority: "high" | "medium" | "low";
};

export type RevenueAiDashboard = {
  receitaTotal: number;
  lucroTotal: number;
  melhorProduto: RevenueBestCard | null;
  melhorPais: RevenueBestCard | null;
  melhorPlataforma: RevenueBestCard | null;
  receitaPorMoeda: RevenueChartPoint[];
  roasMedio: number | null;
  roiMedio: number | null;
  chartReceita30Dias: RevenueChartPoint[];
  chartReceita90Dias: RevenueChartPoint[];
  chartReceitaPorPais: RevenueChartPoint[];
  chartReceitaPorPlataforma: RevenueChartPoint[];
  insights: RevenueInsight[];
  totalMetrics: number;
};

export type RevenueForecastResult = {
  forecast: RevenueForecast | null;
  predictedRevenue: number;
  predictedProfit: number;
  confidence: number;
  recommendation: string;
};

export function calculateProfit(revenue: number, spend: number): number {
  return revenue - spend;
}

export function calculateRoas(revenue: number, spend: number): number | null {
  if (spend <= 0) return revenue > 0 ? null : 0;
  return revenue / spend;
}

export function calculateRoi(profit: number, spend: number): number | null {
  if (spend <= 0) return profit > 0 ? null : 0;
  return (profit / spend) * 100;
}

function readMetaString(metadata: Json, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function groupSum(
  metrics: RevenueMetric[],
  keyFn: (metric: RevenueMetric) => string | null,
  valueFn: (metric: RevenueMetric) => number = (m) => Number(m.revenue ?? 0)
): Map<string, number> {
  const map = new Map<string, number>();
  for (const metric of metrics) {
    const key = keyFn(metric);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + valueFn(metric));
  }
  return map;
}

function mapToChartPoints(map: Map<string, number>): RevenueChartPoint[] {
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] ?? 0;
  return entries.map(([label, value]) => ({
    label,
    value,
    pct: max > 0 ? Math.round((value / max) * 100) : 0,
  }));
}

function filterByDays(metrics: RevenueMetric[], days: number): RevenueMetric[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  return metrics.filter((m) => m.date >= cutoffIso);
}

function buildDailyChart(metrics: RevenueMetric[], days: number): RevenueChartPoint[] {
  const filtered = filterByDays(metrics, days);
  const map = new Map<string, number>();

  for (const metric of filtered) {
    map.set(metric.date, (map.get(metric.date) ?? 0) + Number(metric.revenue ?? 0));
  }

  const points: RevenueChartPoint[] = [];
  const start = new Date();
  start.setDate(start.getDate() - days + 1);

  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const value = map.get(iso) ?? 0;
    points.push({ label: iso.slice(5), value, pct: 0 });
  }

  const max = Math.max(...points.map((p) => p.value), 0);
  return points.map((p) => ({ ...p, pct: max > 0 ? Math.round((p.value / max) * 100) : 0 }));
}

function pickBestGrouped(
  metrics: RevenueMetric[],
  keyFn: (metric: RevenueMetric) => string | null
): RevenueBestCard | null {
  const groups = groupSum(metrics, keyFn);
  if (groups.size === 0) return null;

  const [label, value] = [...groups.entries()].sort((a, b) => b[1] - a[1])[0];
  const groupMetrics = metrics.filter((m) => keyFn(m) === label);
  const roasValues = groupMetrics.map((m) => Number(m.roas ?? 0)).filter((v) => v > 0);
  const roiValues = groupMetrics.map((m) => Number(m.roi ?? 0)).filter((v) => v !== 0);

  return {
    label,
    value,
    currency: groupMetrics[0]?.currency ?? "BRL",
    roas:
      roasValues.length > 0 ? roasValues.reduce((a, b) => a + b, 0) / roasValues.length : null,
    roi: roiValues.length > 0 ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length : null,
  };
}

export function computeRevenueAiDashboard(metrics: RevenueMetric[]): RevenueAiDashboard {
  const receitaTotal = metrics.reduce((sum, m) => sum + Number(m.revenue ?? 0), 0);
  const lucroTotal = metrics.reduce((sum, m) => sum + Number(m.profit ?? 0), 0);

  const roasValues = metrics.map((m) => Number(m.roas ?? 0)).filter((v) => v > 0);
  const roiValues = metrics.map((m) => Number(m.roi ?? 0)).filter((v) => v !== 0);

  const productGroups = groupSum(metrics, (m) =>
    m.product_id ? readMetaString(m.metadata, "product_label") ?? m.product_id.slice(0, 8) : null
  );

  let melhorProduto: RevenueBestCard | null = null;
  if (productGroups.size > 0) {
    const [label, value] = [...productGroups.entries()].sort((a, b) => b[1] - a[1])[0];
    const groupMetrics = metrics.filter(
      (m) =>
        m.product_id &&
        (readMetaString(m.metadata, "product_label") ?? m.product_id.slice(0, 8)) === label
    );
    melhorProduto = {
      label,
      value,
      currency: groupMetrics[0]?.currency ?? "BRL",
      roas: average(groupMetrics.map((m) => Number(m.roas ?? 0)).filter((v) => v > 0)),
      roi: average(groupMetrics.map((m) => Number(m.roi ?? 0)).filter((v) => v !== 0)),
    };
  }

  return {
    receitaTotal,
    lucroTotal,
    melhorProduto,
    melhorPais: pickBestGrouped(metrics, (m) => m.country),
    melhorPlataforma: pickBestGrouped(metrics, (m) => m.platform),
    receitaPorMoeda: mapToChartPoints(groupSum(metrics, (m) => m.currency ?? "BRL")),
    roasMedio: average(roasValues),
    roiMedio: average(roiValues),
    chartReceita30Dias: buildDailyChart(metrics, 30),
    chartReceita90Dias: buildDailyChart(metrics, 90),
    chartReceitaPorPais: mapToChartPoints(groupSum(metrics, (m) => m.country ?? "—")),
    chartReceitaPorPlataforma: mapToChartPoints(groupSum(metrics, (m) => m.platform ?? "—")),
    insights: generateRevenueInsightsFromMetrics(metrics),
    totalMetrics: metrics.length,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function generateRevenueInsightsFromMetrics(metrics: RevenueMetric[]): RevenueInsight[] {
  if (metrics.length === 0) {
    return [
      {
        id: "empty",
        title: "Sem métricas registradas",
        summary: "Conecte Kiwify, Meta ou registre vendas para iniciar a inteligência financeira.",
        priority: "medium",
      },
    ];
  }

  const dashboard = computeRevenueAiDashboard(metrics);
  const insights: RevenueInsight[] = [];

  if (dashboard.roasMedio != null && dashboard.roasMedio >= 2) {
    insights.push({
      id: "scale-roas",
      title: "ROAS saudável",
      summary: `ROAS médio de ${dashboard.roasMedio.toFixed(2)}x — considere escalar investimento.`,
      priority: "high",
    });
  } else if (dashboard.roasMedio != null && dashboard.roasMedio < 1) {
    insights.push({
      id: "fix-roas",
      title: "ROAS abaixo do ideal",
      summary: "Retorno abaixo do investimento — revise criativos, oferta e funil.",
      priority: "high",
    });
  }

  if (dashboard.melhorPlataforma) {
    insights.push({
      id: "best-platform",
      title: "Melhor plataforma",
      summary: `${dashboard.melhorPlataforma.label} lidera com R$ ${dashboard.melhorPlataforma.value.toFixed(2)} em receita.`,
      priority: "medium",
    });
  }

  if (dashboard.melhorPais) {
    insights.push({
      id: "best-country",
      title: "Melhor mercado",
      summary: `${dashboard.melhorPais.label} concentra a maior receita registrada.`,
      priority: "medium",
    });
  }

  if (dashboard.lucroTotal < 0) {
    insights.push({
      id: "negative-profit",
      title: "Lucro negativo",
      summary: "Despesas superam receitas — reduza gastos ou otimize conversão.",
      priority: "high",
    });
  }

  return insights.slice(0, 6);
}

export function buildRevenueForecast(params: {
  metrics: RevenueMetric[];
  period: "weekly" | "monthly" | "quarterly";
}): RevenueForecastResult {
  const { metrics, period } = params;
  const days = period === "weekly" ? 7 : period === "monthly" ? 30 : 90;
  const recent = filterByDays(metrics, days);

  const totalRevenue = recent.reduce((sum, m) => sum + Number(m.revenue ?? 0), 0);
  const totalProfit = recent.reduce((sum, m) => sum + Number(m.profit ?? 0), 0);
  const avgDailyRevenue = recent.length > 0 ? totalRevenue / days : 0;
  const avgDailyProfit = recent.length > 0 ? totalProfit / days : 0;

  const forecastDays = period === "weekly" ? 7 : period === "monthly" ? 30 : 90;
  const predictedRevenue = avgDailyRevenue * forecastDays;
  const predictedProfit = avgDailyProfit * forecastDays;
  const confidence = Math.min(95, Math.max(25, 40 + recent.length * 3));

  let recommendation = "Continue registrando vendas para aumentar a precisão da previsão.";
  if (predictedProfit > 0 && avgDailyRevenue > 0) {
    recommendation = `Projeção positiva de R$ ${predictedRevenue.toFixed(2)} — mantenha escala nas plataformas vencedoras.`;
  } else if (predictedProfit <= 0) {
    recommendation = "Projeção de lucro negativo — revise gastos em ads e otimize conversão.";
  }

  return {
    forecast: null,
    predictedRevenue,
    predictedProfit,
    confidence,
    recommendation,
  };
}

export function buildRevenueAiAuraContext(dashboard: RevenueAiDashboard): string {
  return [
    "## REVENUE AI",
    `Receita total: R$ ${dashboard.receitaTotal.toFixed(2)}`,
    `Lucro total: R$ ${dashboard.lucroTotal.toFixed(2)}`,
    dashboard.roasMedio != null ? `ROAS médio: ${dashboard.roasMedio.toFixed(2)}x` : null,
    dashboard.roiMedio != null ? `ROI médio: ${dashboard.roiMedio.toFixed(1)}%` : null,
    dashboard.melhorPlataforma
      ? `Melhor plataforma: ${dashboard.melhorPlataforma.label}`
      : null,
    dashboard.insights[0] ? `Insight: ${dashboard.insights[0].summary}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
