import { recordSystemLog } from "@/lib/logs/record";
import {
  GrowthBrainMemoriesRepository,
  GrowthPatternsRepository,
} from "@/lib/supabase/repositories/growth-brain.repository";
import type { GrowthBrainMemory, GrowthPattern, Json, TableInsert } from "@/types/database";
import {
  buildGrowthBrainAuraContext,
  computeGrowthBrainDashboard,
  computeMemoryScore,
  generateGrowthInsightsFromMemories,
  generateRecommendationsFromMemories,
  type GrowthBrainDashboard,
  type GrowthInsight,
  readGrowthMetricType,
  type GrowthRecommendation,
  type GrowthResultInput,
} from "@/utils/growth-brain";
import { enrichGrowthProductLabelInput } from "./growth-product-label.service";
import { getOptionalDataContext } from "./context";
import { todayIsoDate } from "@/utils/health";
import { buildMetricIdempotencyKey } from "@/utils/metric-idempotency";

function resolveGrowthEntityId(input: GrowthResultInput): string {
  return (
    input.campaignId ??
    input.operationId ??
    input.productId ??
    input.creativeId ??
    input.copyId ??
    input.landingId ??
    "global"
  );
}

export { resolveGrowthProductLabel, enrichGrowthProductLabelInput } from "./growth-product-label.service";

function toMemoryPayload(
  input: GrowthResultInput
): Omit<TableInsert<"growth_brain_memories">, "user_id"> {
  const metricType = input.metricType ?? "real";
  const metadata: Json = {
    ...(typeof input.metadata === "object" && input.metadata && !Array.isArray(input.metadata)
      ? (input.metadata as Record<string, unknown>)
      : {}),
    ...(input.niche ? { niche: input.niche } : {}),
    metric_type: metricType,
  };

  return {
    operation_id: input.operationId ?? null,
    product_id: input.productId ?? null,
    copy_id: input.copyId ?? null,
    creative_id: input.creativeId ?? null,
    landing_id: input.landingId ?? null,
    campaign_id: input.campaignId ?? null,
    source_platform: input.sourcePlatform ?? null,
    country: input.country ?? null,
    language: input.language ?? null,
    ctr: input.ctr ?? null,
    cpc: input.cpc ?? null,
    cpa: input.cpa ?? null,
    roas: input.roas ?? null,
    revenue: input.revenue ?? null,
    spend: input.spend ?? null,
    conversion_rate: input.conversionRate ?? null,
    status: input.status ?? "active",
    lesson: input.lesson ?? null,
    recommendation: input.recommendation ?? null,
    metadata,
  };
}

function readMetaLabel(memory: GrowthBrainMemory, keys: string[]): string | null {
  if (!memory.metadata || typeof memory.metadata !== "object" || Array.isArray(memory.metadata)) {
    return null;
  }
  const meta = memory.metadata as Record<string, unknown>;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function extractProductNameFromMemory(memory: GrowthBrainMemory): string | null {
  return (
    readMetaLabel(memory, ["product_label", "product_name", "campaign_label"]) ??
    readNiche(memory)
  );
}

async function feedMarketHunterFromMemory(memory: GrowthBrainMemory): Promise<void> {
  const productName = extractProductNameFromMemory(memory);
  if (!productName) return;

  const score = Math.round(computeMemoryScore(memory));
  const { feedMarketHunterFromGrowthBrain } = await import("./market-hunter.service");
  await feedMarketHunterFromGrowthBrain({
    productName,
    niche: readNiche(memory),
    country: memory.country,
    score,
  });

  console.info("[growth-brain-feed] Market Hunter updated", {
    productName,
    score,
    memoryId: memory.id,
    sourcePlatform: memory.source_platform,
  });

  recordSystemLog({
    tipo: "info",
    modulo: "growth-brain-feed",
    mensagem: `Market Hunter alimentado: ${productName}`,
    detalhes: {
      productName,
      score,
      memoryId: memory.id,
      sourcePlatform: memory.source_platform,
    },
  });
}

async function persistMemory(
  input: GrowthResultInput
): Promise<{ memory: GrowthBrainMemory | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { memory: null, error: "Usuário não autenticado." };

  const baseMeta =
    input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? (input.metadata as Record<string, unknown>)
      : {};
  const enriched = await enrichGrowthProductLabelInput({
    operationId: input.operationId,
    productId: input.productId,
    copyId: input.copyId,
    creativeId: input.creativeId,
    landingId: input.landingId,
    campaignId: input.campaignId,
    niche: input.niche,
    metadata: baseMeta,
  });

  const payload = toMemoryPayload({
    ...input,
    operationId: enriched.operationId,
    productId: enriched.productId,
    niche: enriched.niche,
    metadata: enriched.metadata as Json,
  });

  const metricType = input.metricType ?? "real";
  const idempotencyKey = buildMetricIdempotencyKey({
    source: input.sourcePlatform ?? "growth_brain",
    entityId: resolveGrowthEntityId({
      ...input,
      operationId: enriched.operationId,
      productId: enriched.productId,
    }),
    metricType,
    date: todayIsoDate(),
  });

  const payloadWithKey = {
    ...payload,
    metadata: {
      ...(typeof payload.metadata === "object" && payload.metadata && !Array.isArray(payload.metadata)
        ? (payload.metadata as Record<string, unknown>)
        : {}),
      idempotency_key: idempotencyKey,
    } as Json,
  };

  const repo = new GrowthBrainMemoriesRepository(ctx.supabase, ctx.userId);
  const existing = await repo.findByIdempotencyKey(idempotencyKey);
  const result = existing.data
    ? await repo.update(existing.data.id, payloadWithKey)
    : await repo.create(payloadWithKey);

  if (result.data) {
    const action = existing.data ? "updated" : "created";
    recordSystemLog({
      tipo: "info",
      modulo: "growth-brain-feed",
      mensagem: `Memória ${action === "updated" ? "atualizada" : "registrada"}: ${result.data.source_platform ?? "growth_brain"}`,
      detalhes: {
        memoryId: result.data.id,
        productLabel: extractProductNameFromMemory(result.data),
        metricType: readGrowthMetricType(result.data),
        sourcePlatform: result.data.source_platform,
        idempotencyKey,
        action,
      },
    });

    if (!existing.data) {
      void feedMarketHunterFromMemory(result.data).catch((err) => {
        console.warn("[growth-brain-feed] Market Hunter feed failed", {
          memoryId: result.data?.id,
          error: err instanceof Error ? err.message : String(err),
        });
        recordSystemLog({
          tipo: "warning",
          modulo: "growth-brain-feed",
          mensagem: "Falha ao alimentar Market Hunter",
          detalhes: {
            memoryId: result.data?.id,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      });
    }
  }

  return { memory: result.data, error: result.error };
}

export async function registerCampaignResult(
  input: GrowthResultInput
): Promise<{ memory: GrowthBrainMemory | null; error: string | null }> {
  return persistMemory({
    ...input,
    sourcePlatform: input.sourcePlatform ?? "meta_ads",
  });
}

export async function registerCreativeResult(
  input: GrowthResultInput
): Promise<{ memory: GrowthBrainMemory | null; error: string | null }> {
  if (!input.creativeId) {
    return { memory: null, error: "creativeId é obrigatório." };
  }
  return persistMemory({
    ...input,
    sourcePlatform: input.sourcePlatform ?? "creative_factory",
  });
}

export async function registerLandingResult(
  input: GrowthResultInput
): Promise<{ memory: GrowthBrainMemory | null; error: string | null }> {
  if (!input.landingId) {
    return { memory: null, error: "landingId é obrigatório." };
  }
  return persistMemory({
    ...input,
    sourcePlatform: input.sourcePlatform ?? "landing_factory",
  });
}

export async function registerCopyResult(
  input: GrowthResultInput
): Promise<{ memory: GrowthBrainMemory | null; error: string | null }> {
  if (!input.copyId) {
    return { memory: null, error: "copyId é obrigatório." };
  }
  return persistMemory({
    ...input,
    sourcePlatform: input.sourcePlatform ?? "copylab",
  });
}

export async function generateGrowthInsights(): Promise<{
  insights: GrowthInsight[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { insights: [], error: "Usuário não autenticado." };

  const repo = new GrowthBrainMemoriesRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findActive();
  if (error) return { insights: [], error };

  return {
    insights: generateGrowthInsightsFromMemories(data ?? []),
    error: null,
  };
}

export async function generateRecommendations(): Promise<{
  recommendations: GrowthRecommendation[];
  patterns: GrowthPattern[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { recommendations: [], patterns: [], error: "Usuário não autenticado." };

  const memoriesRepo = new GrowthBrainMemoriesRepository(ctx.supabase, ctx.userId);
  const patternsRepo = new GrowthPatternsRepository(ctx.supabase, ctx.userId);

  const [memoriesRes, patternsRes] = await Promise.all([
    memoriesRepo.findActive(),
    patternsRepo.findAll(),
  ]);

  if (memoriesRes.error || patternsRes.error) {
    return {
      recommendations: [],
      patterns: [],
      error: memoriesRes.error ?? patternsRes.error,
    };
  }

  const memories = memoriesRes.data ?? [];
  const patterns = patternsRes.data ?? [];

  await syncPatternsFromMemories(memories, patternsRepo);

  const refreshed = await patternsRepo.findAll();
  const finalPatterns = refreshed.data ?? patterns;

  return {
    recommendations: generateRecommendationsFromMemories(memories, finalPatterns),
    patterns: finalPatterns,
    error: null,
  };
}

async function syncPatternsFromMemories(
  memories: GrowthBrainMemory[],
  patternsRepo: GrowthPatternsRepository
): Promise<void> {
  if (memories.length === 0) return;

  const bestCopy = memories
    .filter((m) => m.copy_id)
    .sort((a, b) => computeMemoryScore(b) - computeMemoryScore(a))[0];
  const bestCreative = memories
    .filter((m) => m.creative_id)
    .sort((a, b) => computeMemoryScore(b) - computeMemoryScore(a))[0];
  const bestLanding = memories
    .filter((m) => m.landing_id)
    .sort((a, b) => computeMemoryScore(b) - computeMemoryScore(a))[0];
  const bestCampaign = memories
    .filter((m) => m.campaign_id)
    .sort((a, b) => computeMemoryScore(b) - computeMemoryScore(a))[0];

  const upserts: Array<Omit<TableInsert<"growth_patterns">, "user_id">> = [];

  if (bestCopy) {
    upserts.push({
      pattern_type: "copy",
      niche: readNiche(bestCopy),
      country: bestCopy.country,
      language: bestCopy.language,
      score: computeMemoryScore(bestCopy),
      lesson: bestCopy.lesson,
      recommendation: bestCopy.recommendation,
    });
  }
  if (bestCreative) {
    upserts.push({
      pattern_type: "creative",
      niche: readNiche(bestCreative),
      country: bestCreative.country,
      language: bestCreative.language,
      score: computeMemoryScore(bestCreative),
      lesson: bestCreative.lesson,
      recommendation: bestCreative.recommendation,
    });
  }
  if (bestLanding) {
    upserts.push({
      pattern_type: "landing",
      niche: readNiche(bestLanding),
      country: bestLanding.country,
      language: bestLanding.language,
      score: computeMemoryScore(bestLanding),
      lesson: bestLanding.lesson,
      recommendation: bestLanding.recommendation,
    });
  }
  if (bestCampaign) {
    upserts.push({
      pattern_type: "campaign",
      niche: readNiche(bestCampaign),
      country: bestCampaign.country,
      language: bestCampaign.language,
      score: computeMemoryScore(bestCampaign),
      lesson: bestCampaign.lesson,
      recommendation: bestCampaign.recommendation,
    });
  }

  const nicheGroups = groupBy(memories, (m) => readNiche(m));
  const countryGroups = groupBy(memories, (m) => m.country);
  const languageGroups = groupBy(memories, (m) => m.language);

  for (const [niche, list] of nicheGroups) {
    if (!niche) continue;
    const top = list.sort((a, b) => computeMemoryScore(b) - computeMemoryScore(a))[0];
    upserts.push({
      pattern_type: "niche",
      niche,
      country: top.country,
      language: top.language,
      score: averageScore(list),
      lesson: top.lesson,
      recommendation: top.recommendation,
    });
  }

  for (const [country, list] of countryGroups) {
    if (!country) continue;
    const top = list.sort((a, b) => computeMemoryScore(b) - computeMemoryScore(a))[0];
    upserts.push({
      pattern_type: "country",
      niche: readNiche(top),
      country,
      language: top.language,
      score: averageScore(list),
      lesson: top.lesson,
      recommendation: top.recommendation,
    });
  }

  for (const [language, list] of languageGroups) {
    if (!language) continue;
    const top = list.sort((a, b) => computeMemoryScore(b) - computeMemoryScore(a))[0];
    upserts.push({
      pattern_type: "language",
      niche: readNiche(top),
      country: top.country,
      language,
      score: averageScore(list),
      lesson: top.lesson,
      recommendation: top.recommendation,
    });
  }

  for (const payload of upserts) {
    await patternsRepo.upsertPattern(payload);
  }
}

function readNiche(memory: GrowthBrainMemory): string | null {
  if (!memory.metadata || typeof memory.metadata !== "object" || Array.isArray(memory.metadata)) {
    return null;
  }
  const niche = (memory.metadata as Record<string, unknown>).niche;
  return typeof niche === "string" && niche.trim() ? niche.trim() : null;
}

function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string | null
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function averageScore(memories: GrowthBrainMemory[]): number {
  if (memories.length === 0) return 0;
  return memories.reduce((sum, item) => sum + computeMemoryScore(item), 0) / memories.length;
}

export async function getGrowthBrainDashboard(): Promise<{
  dashboard: GrowthBrainDashboard | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { dashboard: null, error: "Usuário não autenticado." };

  const memoriesRepo = new GrowthBrainMemoriesRepository(ctx.supabase, ctx.userId);
  const patternsRepo = new GrowthPatternsRepository(ctx.supabase, ctx.userId);

  const [memoriesRes, patternsRes] = await Promise.all([
    memoriesRepo.findRecent(1000),
    patternsRepo.findAll(),
  ]);

  if (memoriesRes.error || patternsRes.error) {
    return { dashboard: null, error: memoriesRes.error ?? patternsRes.error };
  }

  const memories = memoriesRes.data ?? [];
  const patterns = patternsRes.data ?? [];

  await syncPatternsFromMemories(memories.filter((m) => m.status === "active"), patternsRepo);
  const refreshedPatterns = await patternsRepo.findAll();

  const dashboard = computeGrowthBrainDashboard(memories, refreshedPatterns.data ?? patterns);
  return { dashboard, error: null };
}

export async function getGrowthBrainContext(): Promise<{ context: string; error: string | null }> {
  const { dashboard, error } = await getGrowthBrainDashboard();
  if (error || !dashboard) return { context: "", error: error ?? "Erro ao carregar Growth Brain." };
  return { context: buildGrowthBrainAuraContext(dashboard), error: null };
}

export async function feedGrowthBrainFromPerformance(params: {
  score: number;
  roasEstimado?: number | null;
  revenue?: number | null;
  spend?: number | null;
  operationId?: string | null;
  productId?: string | null;
  productLabel?: string | null;
  copyId?: string | null;
  creativeId?: string | null;
  landingId?: string | null;
  campaignId?: string | null;
  lesson?: string | null;
  recommendation?: string | null;
  metricType?: "estimated" | "real";
}): Promise<void> {
  const metricType = params.metricType ?? "estimated";
  await registerCampaignResult({
    operationId: params.operationId,
    productId: params.productId,
    copyId: params.copyId,
    creativeId: params.creativeId,
    landingId: params.landingId,
    campaignId: params.campaignId,
    sourcePlatform: "performance_ai",
    roas: metricType === "real" ? params.roasEstimado : null,
    revenue: params.revenue,
    spend: params.spend,
    conversionRate: params.score / 100,
    metricType,
    lesson: params.lesson ?? `Performance score ${params.score}`,
    recommendation: params.recommendation,
    metadata: {
      source: "performance_ai",
      product_label: params.productLabel,
      roas_estimado: params.roasEstimado ?? null,
      roas_real: metricType === "real" ? params.roasEstimado ?? null : null,
      roi_estimado: params.roasEstimado ?? null,
      roi_real: null,
    },
  });
}

export async function feedGrowthBrainFromRevenue(params: {
  revenue: number;
  spend: number;
  roas: number;
  conversionRate?: number | null;
}): Promise<void> {
  await registerCampaignResult({
    sourcePlatform: "revenue_center",
    revenue: params.revenue,
    spend: params.spend,
    roas: params.roas,
    conversionRate: params.conversionRate ?? null,
    lesson: `Receita R$ ${params.revenue.toFixed(2)} · Gasto R$ ${params.spend.toFixed(2)}`,
    recommendation:
      params.roas >= 2
        ? "Escale investimento nas fontes com melhor ROAS."
        : "Revise funil e criativos antes de aumentar budget.",
    metadata: { source: "revenue_center" },
  });
}

export async function feedGrowthBrainFromOperation(params: {
  operationId: string;
  productId?: string | null;
  productName?: string | null;
  copyId?: string | null;
  creativeId?: string | null;
  landingId?: string | null;
  campaignId?: string | null;
  operationalScore?: number | null;
  roiPrevisto?: number | null;
}): Promise<void> {
  await registerCampaignResult({
    operationId: params.operationId,
    productId: params.productId,
    copyId: params.copyId,
    creativeId: params.creativeId,
    landingId: params.landingId,
    campaignId: params.campaignId,
    sourcePlatform: "operation_center",
    roas: params.roiPrevisto,
    conversionRate: params.operationalScore != null ? params.operationalScore / 100 : null,
    metricType: "estimated",
    lesson: params.productName
      ? `Operação ${params.productName} aprovada com score ${params.operationalScore ?? "—"}`
      : "Operação aprovada no Operation Center",
    recommendation: "Monitore performance real e alimente o Growth Brain com resultados.",
    metadata: {
      source: "operation_center",
      product_name: params.productName,
      product_label: params.productName,
    },
  });
}

export async function feedGrowthBrainFromMeta(params: {
  campaignId?: string | null;
  campaignName?: string | null;
  country?: string | null;
  language?: string | null;
  ctr?: number | null;
  cpc?: number | null;
  cpa?: number | null;
  roas?: number | null;
  spend?: number | null;
  revenue?: number | null;
  recommendation?: string | null;
}): Promise<void> {
  await registerCampaignResult({
    campaignId: params.campaignId,
    sourcePlatform: "meta_intelligence",
    country: params.country,
    language: params.language,
    ctr: params.ctr,
    cpc: params.cpc,
    cpa: params.cpa,
    roas: params.roas,
    spend: params.spend,
    revenue: params.revenue,
    lesson: params.campaignName
      ? `Campanha Meta ${params.campaignName} sincronizada`
      : "Métricas Meta sincronizadas",
    recommendation: params.recommendation,
    metadata: {
      source: "meta_intelligence",
      campaign_label: params.campaignName,
    },
  });
}

export async function feedGrowthBrainFromKiwify(params: {
  productId?: string | null;
  productName?: string | null;
  niche?: string | null;
  revenue?: number | null;
  conversionRate?: number | null;
  recommendation?: string | null;
}): Promise<void> {
  await registerCampaignResult({
    productId: params.productId,
    sourcePlatform: "kiwify_intelligence",
    revenue: params.revenue,
    conversionRate: params.conversionRate,
    niche: params.niche,
    lesson: params.productName
      ? `Vendas Kiwify — ${params.productName}`
      : "Vendas Kiwify registradas",
    recommendation: params.recommendation,
    metadata: {
      source: "kiwify_intelligence",
      niche: params.niche,
      product_label: params.productName,
    },
  });

  if (params.productName) {
    void import("./market-hunter.service")
      .then(({ feedMarketHunterFromKiwify }) =>
        feedMarketHunterFromKiwify({
          productName: params.productName!,
          productId: params.productId,
          niche: params.niche,
          revenue: params.revenue,
          conversionRate: params.conversionRate,
        })
      )
      .catch(() => undefined);
  }
}
