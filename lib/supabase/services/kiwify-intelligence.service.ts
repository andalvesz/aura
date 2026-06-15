import {
  KiwifyCommissionsRepository,
  KiwifyConnectionsRepository,
  KiwifyProductsRepository,
  KiwifySalesRepository,
} from "@/lib/supabase/repositories/kiwify-connect.repository";
import { MoneyMissionPlansRepository } from "@/lib/supabase/repositories/money.repository";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import { syncKiwifyConnection } from "@/lib/supabase/services/kiwify-connect.service";
import type {
  KiwifyCommission,
  KiwifyConnection,
  KiwifyProduct,
  KiwifySale,
} from "@/types/database";
import type {
  KiwifyCreatorComparison,
  KiwifyIntelligenceMetrics,
  KiwifyPerformanceInsight,
} from "@/utils/kiwify-intelligence";
import {
  buildKiwifyAuraContext,
  buildKiwifyMoneyMissionBlock,
  compareCreatorWithKiwifyCatalog,
  computeKiwifyIntelligenceMetrics,
  generateKiwifyPerformanceInsights,
  shouldAutoSyncKiwify,
} from "@/utils/kiwify-intelligence";
import { getOptionalDataContext } from "./context";

export type KiwifyIntelligencePayload = {
  connection: KiwifyConnection | null;
  products: KiwifyProduct[];
  sales: KiwifySale[];
  commissions: KiwifyCommission[];
  metrics: KiwifyIntelligenceMetrics;
  insights: KiwifyPerformanceInsight[];
  connected: boolean;
};

async function loadKiwifyData() {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado.", data: null };

  const connRepo = new KiwifyConnectionsRepository(ctx.supabase, ctx.userId);
  const productsRepo = new KiwifyProductsRepository(ctx.supabase, ctx.userId);
  const salesRepo = new KiwifySalesRepository(ctx.supabase, ctx.userId);
  const commissionsRepo = new KiwifyCommissionsRepository(ctx.supabase, ctx.userId);

  const [connection, productsRes, salesRes, commissionsRes] = await Promise.all([
    connRepo.findForUser(),
    productsRepo.findAllOrdered(),
    salesRepo.findRecent(500),
    commissionsRepo.findRecent(500),
  ]);

  return {
    error: null,
    data: {
      ctx,
      connection: connection.data,
      products: productsRes.data ?? [],
      sales: salesRes.data ?? [],
      commissions: commissionsRes.data ?? [],
    },
  };
}

export async function getKiwifyIntelligence(): Promise<{
  error: string | null;
  data: KiwifyIntelligencePayload | null;
}> {
  const loaded = await loadKiwifyData();
  if (loaded.error || !loaded.data) return { error: loaded.error ?? "Erro ao carregar.", data: null };

  const { connection, products, sales, commissions } = loaded.data;
  const connected = connection?.status === "connected";

  const metrics = computeKiwifyIntelligenceMetrics({
    products,
    sales,
    commissions,
    connection,
  });

  const insights = generateKiwifyPerformanceInsights({ metrics, products, sales });

  return {
    error: null,
    data: {
      connection,
      products,
      sales,
      commissions,
      metrics,
      insights,
      connected,
    },
  };
}

export async function getKiwifyIntelligenceContext(): Promise<{ context: string; error: string | null }> {
  const result = await getKiwifyIntelligence();
  if (result.error || !result.data) {
    return { context: "", error: result.error };
  }

  return {
    context: buildKiwifyAuraContext({
      metrics: result.data.metrics,
      insights: result.data.insights,
      connected: result.data.connected,
    }),
    error: null,
  };
}

export async function analyzeKiwifyPerformance(): Promise<{
  insights: KiwifyPerformanceInsight[];
  metrics: KiwifyIntelligenceMetrics | null;
  error: string | null;
}> {
  const result = await getKiwifyIntelligence();
  if (result.error || !result.data) {
    return { insights: [], metrics: null, error: result.error ?? "Erro na análise." };
  }
  if (!result.data.connected) {
    return { insights: [], metrics: null, error: "Conecte a Kiwify primeiro." };
  }
  return {
    insights: result.data.insights,
    metrics: result.data.metrics,
    error: null,
  };
}

export async function syncMoneyMissionFromKiwify(): Promise<void> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const intelligence = await getKiwifyIntelligence();
  if (!intelligence.data?.connected) return;

  const plansRepo = new MoneyMissionPlansRepository(ctx.supabase, ctx.userId);
  const { data: plan } = await plansRepo.findActive();
  if (!plan) return;

  const conquistado = intelligence.data.metrics.revenueMonthCents / 100;
  if (Math.abs(Number(plan.valor_conquistado) - conquistado) < 0.01) return;

  await plansRepo.update(plan.id, { valor_conquistado: conquistado });
}

export async function compareNewCreatorProductWithKiwify(params: {
  productName: string;
  nicho: string;
  precoMin: number;
  precoMax: number;
  probabilidadeVenda: number;
}): Promise<KiwifyCreatorComparison | null> {
  const [loaded, legacy] = await Promise.all([loadKiwifyData(), getLegacyContext()]);
  if (!loaded.data) return null;

  const metrics = computeKiwifyIntelligenceMetrics({
    products: loaded.data.products,
    sales: loaded.data.sales,
    commissions: loaded.data.commissions,
    connection: loaded.data.connection,
  });

  return compareCreatorWithKiwifyCatalog({
    ...params,
    legacyContext: legacy.context,
    kiwifyProducts: loaded.data.products,
    topSelling: metrics.topSellingProducts,
  });
}

export async function autoSyncKiwifyIfDue(): Promise<{ synced: boolean; error: string | null }> {
  const loaded = await loadKiwifyData();
  if (!loaded.data) return { synced: false, error: loaded.error };

  const { connection } = loaded.data;
  if (connection?.status !== "connected") return { synced: false, error: null };

  if (!shouldAutoSyncKiwify(connection.last_sync_at)) {
    return { synced: false, error: null };
  }

  const result = await syncKiwifyConnection();
  return { synced: !result.error, error: result.error };
}

export async function getKiwifyMoneyContext(): Promise<string> {
  const [intelligence, ctx] = await Promise.all([
    getKiwifyIntelligence(),
    getOptionalDataContext(),
  ]);

  if (!intelligence.data?.connected || !ctx) return "";

  const plansRepo = new MoneyMissionPlansRepository(ctx.supabase, ctx.userId);
  const { data: plan } = await plansRepo.findActive();

  return buildKiwifyMoneyMissionBlock({
    metrics: intelligence.data.metrics,
    plan: plan ?? null,
  });
}
