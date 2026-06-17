import {
  FinancialIncomeRepository,
  GastosRepository,
  GrowthLeadsRepository,
} from "@/lib/supabase/repositories";
import {
  KiwifySalesRepository,
} from "@/lib/supabase/repositories/kiwify-connect.repository";
import { getKiwifyIntelligence } from "@/lib/supabase/services/kiwify-intelligence.service";
import type {
  FinancialIncome,
  Gasto,
  GrowthLead,
  KiwifySale,
  MetaCampaignMetric,
} from "@/types/database";
import {
  buildRevenueAuraContext,
  computeRevenueDashboard,
  type RevenueDashboardMetrics,
} from "@/utils/revenue";
import { getOptionalDataContext } from "./context";

async function loadRevenueData(): Promise<{
  kiwifySales: KiwifySale[];
  income: FinancialIncome[];
  gastos: Gasto[];
  metaMetrics: MetaCampaignMetric[];
  growthLeads: GrowthLead[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      kiwifySales: [],
      income: [],
      gastos: [],
      metaMetrics: [],
      growthLeads: [],
      error: "Usuário não autenticado.",
    };
  }

  const salesRepo = new KiwifySalesRepository(ctx.supabase, ctx.userId);
  const incomeRepo = new FinancialIncomeRepository(ctx.supabase, ctx.userId);
  const gastosRepo = new GastosRepository(ctx.supabase, ctx.userId);
  const leadsRepo = new GrowthLeadsRepository(ctx.supabase, ctx.userId);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  const [salesRes, incomeRes, gastosRes, leadsRes, metricsRes] = await Promise.all([
    salesRepo.findRecent(1000),
    incomeRepo.findAll("data"),
    gastosRepo.findAll("data"),
    leadsRepo.findAll(),
    ctx.supabase
      .from("meta_campaign_metrics")
      .select("*")
      .eq("user_id", ctx.userId)
      .gte("metrics_date", monthStartIso)
      .order("metrics_date", { ascending: false }),
  ]);

  const error =
    salesRes.error ??
    incomeRes.error ??
    gastosRes.error ??
    leadsRes.error ??
    metricsRes.error?.message ??
    null;

  if (error) {
    return {
      kiwifySales: [],
      income: [],
      gastos: [],
      metaMetrics: [],
      growthLeads: [],
      error,
    };
  }

  return {
    kiwifySales: salesRes.data ?? [],
    income: (incomeRes.data ?? []) as FinancialIncome[],
    gastos: (gastosRes.data ?? []) as Gasto[],
    metaMetrics: (metricsRes.data ?? []) as MetaCampaignMetric[],
    growthLeads: (leadsRes.data ?? []) as GrowthLead[],
    error: null,
  };
}

export async function getRevenueDashboard(): Promise<{
  dashboard: RevenueDashboardMetrics | null;
  error: string | null;
}> {
  const data = await loadRevenueData();
  if (data.error) return { dashboard: null, error: data.error };

  const dashboard = computeRevenueDashboard({
    kiwifySales: data.kiwifySales,
    income: data.income,
    gastos: data.gastos,
    metaMetrics: data.metaMetrics,
    growthLeads: data.growthLeads,
  });

  void import("./growth-brain.service")
    .then(({ feedGrowthBrainFromRevenue }) =>
      feedGrowthBrainFromRevenue({
        revenue: dashboard.lucro.receita.month,
        spend: dashboard.lucro.despesas.month,
        roas: dashboard.lucro.roiPct,
        conversionRate: dashboard.lucro.margemPct / 100,
      })
    )
    .catch(() => undefined);

  void import("./revenue-ai.service")
    .then(({ feedRevenueAiFromSale }) =>
      feedRevenueAiFromSale({
        platform: "revenue_center",
        country: "BR",
        currency: "BRL",
        revenue: dashboard.lucro.receita.month,
        spend: dashboard.lucro.despesas.month,
        roas: dashboard.lucro.roiPct,
        roi: dashboard.lucro.roiPct,
        metadata: { source: "revenue_center" },
      })
    )
    .catch(() => undefined);

  return {
    dashboard,
    error: null,
  };
}

export async function getRevenueNetProfitMonth(): Promise<number> {
  const { dashboard } = await getRevenueDashboard();
  return dashboard?.lucro.lucroLiquido.month ?? 0;
}

export async function getRevenueContext(): Promise<{ context: string; error: string | null }> {
  const { dashboard, error } = await getRevenueDashboard();
  if (error || !dashboard) return { context: "", error: error ?? "Erro ao carregar Revenue Center." };
  return { context: buildRevenueAuraContext(dashboard), error: null };
}

export async function syncRevenueWithKiwify(): Promise<void> {
  await getKiwifyIntelligence();
}
