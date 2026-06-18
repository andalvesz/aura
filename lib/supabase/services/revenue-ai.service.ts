import { recordSystemLog } from "@/lib/logs/record";
import {
  RevenueForecastsRepository,
  RevenueMetricsRepository,
} from "@/lib/supabase/repositories/revenue-ai.repository";
import type { Json, RevenueForecast, RevenueMetric, TableInsert } from "@/types/database";
import {
  buildRevenueAiAuraContext,
  buildRevenueForecast,
  calculateProfit,
  calculateRoas,
  calculateRoi,
  computeRevenueAiDashboard,
  generateRevenueInsightsFromMetrics,
  readMetricType,
  type RevenueAiDashboard,
  type RevenueForecastResult,
  type RevenueInsight,
  type RevenueRegisterInput,
} from "@/utils/revenue-ai";
import { todayIsoDate } from "@/utils/health";
import { getOptionalDataContext } from "./context";

function toMetricPayload(
  input: RevenueRegisterInput
): Omit<TableInsert<"revenue_metrics">, "user_id"> {
  const revenue = Number(input.revenue ?? 0);
  const spend = Number(input.spend ?? 0);
  const profit = input.profit != null ? Number(input.profit) : calculateProfit(revenue, spend);
  const roas = input.roas != null ? Number(input.roas) : calculateRoas(revenue, spend);
  const roi = input.roi != null ? Number(input.roi) : calculateRoi(profit, spend);

  const metricType = input.metricType ?? "real";

  return {
    operation_id: input.operationId ?? null,
    product_id: input.productId ?? null,
    platform: input.platform ?? null,
    country: input.country ?? null,
    currency: (input.currency ?? "BRL") as "BRL" | "USD" | "EUR" | "GBP" | "CAD",
    revenue,
    spend,
    profit,
    roas,
    roi,
    conversions: input.conversions ?? 0,
    clicks: input.clicks ?? 0,
    ctr: input.ctr ?? null,
    cpc: input.cpc ?? null,
    cpa: input.cpa ?? null,
    date: input.date ?? todayIsoDate(),
    metric_type: metricType,
    metadata: {
      ...(typeof input.metadata === "object" && input.metadata && !Array.isArray(input.metadata)
        ? (input.metadata as Record<string, unknown>)
        : {}),
      metric_type: metricType,
    } as Json,
  };
}

async function feedGrowthBrainFromRevenueMetric(metric: RevenueMetric): Promise<void> {
  if (readMetricType(metric) === "estimated") return;
  const { feedGrowthBrainFromRevenue } = await import("./growth-brain.service");
  await feedGrowthBrainFromRevenue({
    revenue: Number(metric.revenue ?? 0),
    spend: Number(metric.spend ?? 0),
    roas: Number(metric.roas ?? 0),
    conversionRate: metric.conversions ? metric.conversions / Math.max(metric.clicks ?? 1, 1) : null,
  });
}

export async function registerRevenue(
  input: RevenueRegisterInput
): Promise<{ metric: RevenueMetric | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { metric: null, error: "Usuário não autenticado." };

  const repo = new RevenueMetricsRepository(ctx.supabase, ctx.userId);
  const result = await repo.create(toMetricPayload(input));

  if (result.data) {
    const metricType = readMetricType(result.data);
    console.info("[revenue-ai] metric registered", {
      platform: result.data.platform,
      metricType,
      revenue: result.data.revenue,
      roas: result.data.roas,
    });

    recordSystemLog({
      tipo: "info",
      modulo: "revenue-ai",
      mensagem: `Métrica registrada (${metricType}): ${result.data.platform ?? "geral"}`,
      detalhes: {
        metricId: result.data.id,
        platform: result.data.platform,
        metricType,
        revenue: result.data.revenue,
        roas: result.data.roas,
        roi: result.data.roi,
      },
    });

    if (metricType === "real") {
      void feedGrowthBrainFromRevenueMetric(result.data).catch(() => undefined);
      const productName =
        result.data.metadata &&
        typeof result.data.metadata === "object" &&
        !Array.isArray(result.data.metadata)
          ? String((result.data.metadata as Record<string, unknown>).productName ?? "") ||
            String((result.data.metadata as Record<string, unknown>).product_label ?? "") ||
            null
          : null;
      void import("./market-hunter.service")
        .then(({ feedMarketHunterFromRevenue }) =>
          feedMarketHunterFromRevenue({
            productName: productName ?? `Receita ${result.data!.platform ?? "geral"}`,
            platform: result.data!.platform,
            country: result.data!.country,
            currency: result.data!.currency,
            revenue: Number(result.data!.revenue ?? 0),
            roas: Number(result.data!.roas ?? 0),
          })
        )
        .catch(() => undefined);
    }
  }

  return { metric: result.data, error: result.error };
}

export { calculateRoas, calculateRoi, calculateProfit } from "@/utils/revenue-ai";

export async function generateForecast(params?: {
  period?: "weekly" | "monthly" | "quarterly";
  forecastType?: "revenue" | "profit" | "growth" | "scale";
}): Promise<{
  forecast: RevenueForecast | null;
  result: RevenueForecastResult | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { forecast: null, result: null, error: "Usuário não autenticado." };

  const period = params?.period ?? "monthly";
  const forecastType = params?.forecastType ?? "revenue";

  const metricsRepo = new RevenueMetricsRepository(ctx.supabase, ctx.userId);
  const forecastsRepo = new RevenueForecastsRepository(ctx.supabase, ctx.userId);

  const { data: metrics, error } = await metricsRepo.findRecent(1000);
  if (error) return { forecast: null, result: null, error };

  const result = buildRevenueForecast({ metrics: metrics ?? [], period });

  const saved = await forecastsRepo.upsertForecast({
    forecast_type: forecastType,
    period,
    predicted_revenue: result.predictedRevenue,
    predicted_profit: result.predictedProfit,
    confidence: result.confidence,
    recommendation: result.recommendation,
    metadata: { source: "revenue_ai" } as Json,
  });

  return {
    forecast: saved.data,
    result: saved.data
      ? {
          ...result,
          forecast: saved.data,
        }
      : result,
    error: saved.error,
  };
}

export async function generateRevenueInsights(): Promise<{
  insights: RevenueInsight[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { insights: [], error: "Usuário não autenticado." };

  const repo = new RevenueMetricsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findRecent(1000);
  if (error) return { insights: [], error };

  const insights = generateRevenueInsightsFromMetrics(data ?? []);

  void import("./growth-brain.service")
    .then(({ feedGrowthBrainFromRevenue }) => {
      const dashboard = computeRevenueAiDashboard(data ?? []);
      if (dashboard.receitaReal <= 0) return;
      return feedGrowthBrainFromRevenue({
        revenue: dashboard.receitaReal,
        spend: data?.filter((m) => readMetricType(m) === "real").reduce((sum, m) => sum + Number(m.spend ?? 0), 0) ?? 0,
        roas: dashboard.roasMedioReal ?? 0,
        conversionRate: dashboard.roiMedioReal != null ? dashboard.roiMedioReal / 100 : null,
      });
    })
    .catch(() => undefined);

  return { insights, error: null };
}

export async function getRevenueAiDashboard(): Promise<{
  dashboard: RevenueAiDashboard | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { dashboard: null, error: "Usuário não autenticado." };

  const repo = new RevenueMetricsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findRecent(2000);
  if (error) return { dashboard: null, error };

  return {
    dashboard: computeRevenueAiDashboard(data ?? []),
    error: null,
  };
}

export async function getRevenueAiContext(): Promise<{ context: string; error: string | null }> {
  const { dashboard, error } = await getRevenueAiDashboard();
  if (error || !dashboard) return { context: "", error: error ?? "Erro ao carregar Revenue AI." };
  return { context: buildRevenueAiAuraContext(dashboard), error: null };
}

export async function feedRevenueAiFromKiwify(params: {
  productId?: string | null;
  productName?: string | null;
  revenue: number;
  country?: string | null;
  currency?: string | null;
  conversions?: number;
}): Promise<void> {
  await registerRevenue({
    productId: params.productId,
    platform: "kiwify",
    country: params.country ?? "BR",
    currency: params.currency ?? "BRL",
    revenue: params.revenue,
    spend: 0,
    conversions: params.conversions ?? 1,
    metadata: { source: "kiwify", product_label: params.productName },
  });
}

export async function feedRevenueAiFromMeta(params: {
  revenue?: number | null;
  spend?: number | null;
  country?: string | null;
  clicks?: number | null;
  conversions?: number | null;
  ctr?: number | null;
  cpc?: number | null;
  cpa?: number | null;
  roas?: number | null;
  campaignName?: string | null;
}): Promise<void> {
  const revenue = Number(params.revenue ?? 0);
  const spend = Number(params.spend ?? 0);
  await registerRevenue({
    platform: "meta_ads",
    country: params.country ?? null,
    currency: "BRL",
    revenue,
    spend,
    roas: params.roas ?? calculateRoas(revenue, spend),
    roi: calculateRoi(calculateProfit(revenue, spend), spend),
    clicks: params.clicks ?? 0,
    conversions: params.conversions ?? 0,
    ctr: params.ctr ?? null,
    cpc: params.cpc ?? null,
    cpa: params.cpa ?? null,
    metadata: { source: "meta_intelligence", campaign_label: params.campaignName },
  });
}

export async function feedRevenueAiFromOperation(params: {
  operationId: string;
  productId?: string | null;
  productName?: string | null;
  revenue?: number | null;
  spend?: number | null;
  roiPrevisto?: number | null;
}): Promise<void> {
  const revenue = Number(params.revenue ?? 0);
  const spend = Number(params.spend ?? 0);
  await registerRevenue({
    operationId: params.operationId,
    productId: params.productId,
    platform: "operation_center",
    country: "BR",
    currency: "BRL",
    revenue,
    spend,
    roi: params.roiPrevisto ?? calculateRoi(calculateProfit(revenue, spend), spend),
    roas: calculateRoas(revenue, spend),
    metricType: revenue > 0 || spend > 0 ? "real" : "estimated",
    metadata: { source: "operation_center", product_label: params.productName },
  });
}

export async function feedRevenueAiFromPerformance(params: {
  revenue?: number | null;
  spend?: number | null;
  roasEstimado?: number | null;
  roiEstimado?: number | null;
  operationId?: string | null;
  productId?: string | null;
  productLabel?: string | null;
}): Promise<void> {
  const revenue = Number(params.revenue ?? 0);
  const spend = Number(params.spend ?? 0);
  const roasEstimado = params.roasEstimado ?? null;
  const roiEstimado = params.roiEstimado ?? roasEstimado;

  await registerRevenue({
    operationId: params.operationId,
    productId: params.productId,
    platform: "performance_ai",
    country: "BR",
    currency: "BRL",
    revenue,
    spend,
    roas: null,
    roi: null,
    metricType: "estimated",
    metadata: {
      source: "performance_ai",
      product_label: params.productLabel,
      roas_estimado: roasEstimado,
      roas_real: null,
      roi_estimado: roiEstimado,
      roi_real: null,
    },
  });
}

export async function feedRevenueAiFromSale(params: RevenueRegisterInput): Promise<void> {
  await registerRevenue(params);
}
