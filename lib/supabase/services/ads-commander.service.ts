import OpenAI from "openai";
import { AdCampaignsRepository } from "@/lib/supabase/repositories/ad-campaigns.repository";
import { AdCreativesRepository } from "@/lib/supabase/repositories/ad-creatives.repository";
import { AdSetsRepository } from "@/lib/supabase/repositories/ad-sets.repository";
import { CreativeAssetsRepository } from "@/lib/supabase/repositories/creative-factory.repository";
import { LandingPagesRepository } from "@/lib/supabase/repositories/landing-factory.repository";
import { OperationCenterRepository } from "@/lib/supabase/repositories/operation-center.repository";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { getMetaIntelligence } from "@/lib/supabase/services/meta-intelligence.service";
import { getResolvedUserBudget } from "@/lib/supabase/services/campaign-budget.service";
import type { AdCampaign, AdCreative, AdSet, Json, OperationCenter, TableInsert } from "@/types/database";
import {
  ADS_COMMANDER_SAFE_MODE,
  computeAdsCommanderDashboard,
  mergeAdsCommanderMetadata,
  readAudienceSuggestions,
  readBudgetSuggestion,
  readRiskAnalysis,
  type AdPlatform,
  type AdsCommanderDashboard,
  type AudienceSuggestion,
  type BudgetSuggestion,
  type RiskAnalysis,
} from "@/utils/ads-commander";
import { readCreativeDirectorMetadata } from "@/utils/creative-director";
import { computeInvestimentoFromBudget } from "@/utils/campaign-budget";
import { getOptionalDataContext } from "./context";

function getOpenAi() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

function parseJsonBlock<T>(text: string): T | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

async function callAdsCommanderAi<T>(system: string, user: string): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

type CampaignContext = {
  operation: OperationCenter | null;
  productName: string;
  promessa: string;
  avatar: string;
  problema: string;
  headline: string | null;
  copyBody: string | null;
  landingUrl: string | null;
  creativeAssets: { id: string; type: string; title: string | null; copy: string | null }[];
  creativeScore: number | null;
  availableBudget: number;
  platform: AdPlatform;
};

async function loadCampaignContext(params: {
  operationId?: string | null;
  platform: AdPlatform;
}): Promise<{ context: CampaignContext | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: null, error: "Usuário não autenticado." };

  let operation: OperationCenter | null = null;
  if (params.operationId) {
    const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
    const { data } = await opRepo.findById(params.operationId);
    operation = data;
  } else {
    const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
    const { data } = await opRepo.findActive();
    operation = data;
  }

  const { bundles } = await loadCreatorBundles();
  const bundle = operation?.product_id
    ? bundles.find((b) => b.product.id === operation!.product_id) ?? null
    : bundles[0] ?? null;

  let headline: string | null = null;
  let copyBody: string | null = null;
  if (operation?.copylab_id) {
    const { records } = await loadCopylabRecords();
    const copy = records.find((c) => c.id === operation!.copylab_id);
    headline = copy?.headline ?? null;
    copyBody = copy?.pagina_vendas ?? copy?.subheadline ?? null;
  }

  let landingUrl: string | null = null;
  if (operation?.landing_id) {
    const landingRepo = new LandingPagesRepository(ctx.supabase, ctx.userId);
    const { data: landing } = await landingRepo.findById(operation.landing_id);
    landingUrl = landing?.published_url ?? landing?.preview_url ?? null;
  }

  const creativeRepo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);
  const creativeAssets: CampaignContext["creativeAssets"] = [];
  if (operation?.id) {
    const { data: assets } = await creativeRepo.findByOperationId(operation.id);
    for (const asset of assets ?? []) {
      if (asset.status !== "ready") continue;
      creativeAssets.push({
        id: asset.id,
        type: asset.asset_type,
        title: asset.title,
        copy: asset.copy,
      });
    }
  }

  const directorMeta = operation ? readCreativeDirectorMetadata(operation.metadata) : null;
  const creativeScore = directorMeta?.creative_score?.overall ?? null;

  const { budget } = await getResolvedUserBudget();

  return {
    context: {
      operation,
      productName: operation?.product_nome ?? bundle?.product.nome ?? "Produto",
      promessa: bundle?.product.promessa ?? "",
      avatar: bundle?.product.avatar ?? "",
      problema: bundle?.product.problema ?? "",
      headline,
      copyBody,
      landingUrl,
      creativeAssets,
      creativeScore,
      availableBudget: budget.orcamento ?? 500,
      platform: params.platform,
    },
    error: null,
  };
}

export async function generateAudienceSuggestions(params: {
  campaignId?: string;
  context?: CampaignContext;
}): Promise<{ suggestions: AudienceSuggestion[]; error: string | null }> {
  let context = params.context;
  if (!context && params.campaignId) {
    const ctx = await getOptionalDataContext();
    if (!ctx) return { suggestions: [], error: "Usuário não autenticado." };
    const repo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
    const { data: campaign } = await repo.findById(params.campaignId);
    if (!campaign) return { suggestions: [], error: "Campanha não encontrada." };
    const loaded = await loadCampaignContext({
      operationId: campaign.operation_id,
      platform: campaign.platform as AdPlatform,
    });
    context = loaded.context ?? undefined;
  }

  if (!context) {
    return { suggestions: [], error: "Contexto da campanha indisponível." };
  }

  const ai = await callAdsCommanderAi<{ audiences: AudienceSuggestion[] }>(
    `Você é o Ads Commander da Aura — sugere públicos para ${context.platform}.
Responda APENAS JSON: { "audiences": [{ "name": string, "type": "interest"|"lookalike"|"remarketing"|"broad", "targeting": string, "rationale": string, "score": number }] }
3 a 5 públicos, score 0-100. Português do Brasil.`,
    JSON.stringify({
      product: context.productName,
      avatar: context.avatar,
      problema: context.problema,
      platform: context.platform,
      country: "BR",
    })
  );

  if (ai?.audiences?.length) {
    return { suggestions: ai.audiences.slice(0, 5), error: null };
  }

  return {
    suggestions: [
      {
        name: `Interesses — ${context.avatar || context.productName}`,
        type: "interest",
        targeting: context.avatar || context.productName,
        rationale: "Público baseado no avatar do produto.",
        score: 72,
      },
      {
        name: "Lookalike — compradores",
        type: "lookalike",
        targeting: "1% compradores",
        rationale: "Escala com perfil similar a quem já converteu.",
        score: 68,
      },
      {
        name: "Remarketing — visitantes",
        type: "remarketing",
        targeting: "Visitou landing nos últimos 30 dias",
        rationale: "Recupera quem já demonstrou interesse.",
        score: 75,
      },
    ],
    error: null,
  };
}

export async function generateBudgetSuggestions(params: {
  campaignId?: string;
  context?: CampaignContext;
}): Promise<{ suggestion: BudgetSuggestion | null; error: string | null }> {
  let context = params.context;
  if (!context && params.campaignId) {
    const ctx = await getOptionalDataContext();
    if (!ctx) return { suggestion: null, error: "Usuário não autenticado." };
    const repo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
    const { data: campaign } = await repo.findById(params.campaignId);
    if (!campaign) return { suggestion: null, error: "Campanha não encontrada." };
    const loaded = await loadCampaignContext({
      operationId: campaign.operation_id,
      platform: campaign.platform as AdPlatform,
    });
    context = loaded.context ?? undefined;
  }

  if (!context) return { suggestion: null, error: "Contexto indisponível." };

  const base = computeInvestimentoFromBudget(context.availableBudget);

  const ai = await callAdsCommanderAi<BudgetSuggestion>(
    `Você é o Ads Commander — sugere orçamento diário para ${context.platform}.
Responda APENAS JSON: { "daily_min": number, "daily_max": number, "monthly_estimate": number, "level": "baixo"|"medio"|"escala", "rationale": string, "currency": "BRL" }`,
    JSON.stringify({
      product: context.productName,
      available_budget: context.availableBudget,
      platform: context.platform,
      creative_score: context.creativeScore,
    })
  );

  const suggestion: BudgetSuggestion = ai ?? {
    daily_min: base.investimento_diario_min,
    daily_max: base.investimento_diario_max,
    monthly_estimate: base.investimento_mensal_previsto,
    level: base.orcamento_nivel,
    rationale: `Orçamento baseado em R$ ${context.availableBudget} disponíveis.`,
    currency: "BRL",
  };

  return { suggestion, error: null };
}

export async function generateRiskAnalysis(params: {
  campaignId?: string;
  context?: CampaignContext;
  audienceSuggestions?: AudienceSuggestion[];
  budgetSuggestion?: BudgetSuggestion | null;
}): Promise<{ analysis: RiskAnalysis | null; error: string | null }> {
  let context = params.context;
  if (!context && params.campaignId) {
    const ctx = await getOptionalDataContext();
    if (!ctx) return { analysis: null, error: "Usuário não autenticado." };
    const repo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
    const { data: campaign } = await repo.findById(params.campaignId);
    if (!campaign) return { analysis: null, error: "Campanha não encontrada." };
    const loaded = await loadCampaignContext({
      operationId: campaign.operation_id,
      platform: campaign.platform as AdPlatform,
    });
    context = loaded.context ?? undefined;
  }

  if (!context) return { analysis: null, error: "Contexto indisponível." };

  const { data: metaData } = await getMetaIntelligence();
  const metaHints: string[] = [];
  if (metaData?.connected) {
    for (const insight of metaData.insights ?? []) {
      if (insight.severity === "critical" || insight.severity === "warning") {
        metaHints.push(insight.title);
      }
    }
  }

  const ai = await callAdsCommanderAi<RiskAnalysis>(
    `Você é o Ads Commander — analisa riscos de campanha (0-100, maior = mais risco).
Responda APENAS JSON: { "overall_risk": number, "rejection_risk": number, "budget_risk": number, "audience_risk": number, "creative_risk": number, "warnings": string[], "recommendations": string[] }
Nunca sugira publicar automaticamente.`,
    JSON.stringify({
      platform: context.platform,
      product: context.productName,
      headline: context.headline,
      creative_score: context.creativeScore,
      creative_count: context.creativeAssets.length,
      landing_url: context.landingUrl,
      budget: params.budgetSuggestion,
      meta_hints: metaHints,
    })
  );

  if (ai) return { analysis: ai, error: null };

  const creativeRisk = context.creativeScore != null ? Math.max(0, 100 - context.creativeScore) : 40;
  const rejectionRisk =
    context.creativeScore != null
      ? Math.min(100, (readCreativeDirectorMetadata(context.operation?.metadata ?? {})?.creative_score?.risco_reprovacao ?? 25))
      : 35;

  return {
    analysis: {
      overall_risk: Math.round((creativeRisk + rejectionRisk) / 2),
      rejection_risk: rejectionRisk,
      budget_risk: context.availableBudget < 300 ? 55 : 25,
      audience_risk: 30,
      creative_risk: creativeRisk,
      warnings: metaHints.length ? metaHints : ["Revise criativos antes de publicar manualmente."],
      recommendations: [
        "Aprove a campanha apenas após revisar copy e criativos.",
        "Publique manualmente na plataforma — Aura não publica automaticamente.",
      ],
    },
    error: null,
  };
}

export async function prepareCampaign(params: {
  operationId?: string | null;
  platform?: AdPlatform;
}): Promise<{ campaign: AdCampaign | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { campaign: null, error: "Usuário não autenticado." };

  const platform = params.platform ?? "meta";
  const { context, error: ctxError } = await loadCampaignContext({
    operationId: params.operationId,
    platform,
  });
  if (ctxError || !context) return { campaign: null, error: ctxError ?? "Contexto indisponível." };

  const { suggestion: budgetSuggestion } = await generateBudgetSuggestions({ context });
  const { suggestions: audienceSuggestions } = await generateAudienceSuggestions({ context });

  const primaryAudience = audienceSuggestions[0] ?? null;
  const campaignName = `${context.productName} — ${platform.toUpperCase()}`;

  const repo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
  const { data: campaign, error } = await repo.create({
    operation_id: context.operation?.id ?? null,
    platform,
    campaign_name: campaignName,
    objective: platform === "google" ? "conversao" : "conversao",
    budget: budgetSuggestion?.daily_max ?? context.availableBudget / 30,
    country: "BR",
    language: "pt-BR",
    audience: (primaryAudience ?? {}) as Json,
    creatives_json: context.creativeAssets as unknown as Json,
    copy_json: {
      headline: context.headline,
      body: context.copyBody,
      product: context.productName,
    } as Json,
    landing_id: context.operation?.landing_id ?? null,
    status: "draft",
    approval_required: true,
    metadata: mergeAdsCommanderMetadata({}, {
      safe_mode: ADS_COMMANDER_SAFE_MODE.active,
      auto_publish: false,
      budget_suggestion: budgetSuggestion,
      audience_suggestions: audienceSuggestions,
      integrations: {
        operation_center: Boolean(context.operation),
        creative_director: Boolean(readCreativeDirectorMetadata(context.operation?.metadata ?? {})?.ready),
        landing_factory: Boolean(context.landingUrl),
        copylab: Boolean(context.headline),
      },
    }),
  } satisfies Omit<TableInsert<"ad_campaigns">, "user_id">);

  return { campaign, error: error ?? null };
}

export async function prepareAdSets(campaignId: string): Promise<{
  adSets: AdSet[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { adSets: [], error: "Usuário não autenticado." };

  const campaignRepo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
  const { data: campaign } = await campaignRepo.findById(campaignId);
  if (!campaign) return { adSets: [], error: "Campanha não encontrada." };

  const audiences =
    readAudienceSuggestions(campaign.metadata).length > 0
      ? readAudienceSuggestions(campaign.metadata)
      : (await generateAudienceSuggestions({ campaignId })).suggestions;

  const budget = readBudgetSuggestion(campaign.metadata);
  const setRepo = new AdSetsRepository(ctx.supabase, ctx.userId);
  const created: AdSet[] = [];

  const placementsByPlatform: Record<string, string[]> = {
    meta: ["Feed", "Stories", "Reels"],
    google: ["Search", "Display", "YouTube"],
    tiktok: ["For You", "Pangle"],
    other: ["Feed"],
  };

  for (const aud of audiences.slice(0, 3)) {
    const dailyBudget = budget
      ? Math.round((budget.daily_min + budget.daily_max) / 2 / audiences.length)
      : Number(campaign.budget ?? 50);

    const { data: adSet, error } = await setRepo.create({
      campaign_id: campaignId,
      audience: aud as unknown as Json,
      placements: (placementsByPlatform[campaign.platform] ?? ["Feed"]) as unknown as Json,
      budget: dailyBudget,
      status: "ready",
      metadata: { audience_name: aud.name, safe_mode: true } as Json,
    });

    if (adSet) created.push(adSet);
    if (error) return { adSets: created, error };
  }

  return { adSets: created, error: null };
}

export async function prepareCreatives(campaignId: string): Promise<{
  creatives: AdCreative[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { creatives: [], error: "Usuário não autenticado." };

  const campaignRepo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
  const { data: campaign } = await campaignRepo.findById(campaignId);
  if (!campaign) return { creatives: [], error: "Campanha não encontrada." };

  const copyJson = campaign.copy_json as Record<string, unknown> | null;
  const headline =
    typeof copyJson?.headline === "string" ? copyJson.headline : campaign.campaign_name;
  const body = typeof copyJson?.body === "string" ? copyJson.body : "";

  const creativeRepo = new AdCreativesRepository(ctx.supabase, ctx.userId);
  const assetsRepo = new CreativeAssetsRepository(ctx.supabase, ctx.userId);

  let assets: { id: string; type: string; title: string | null; copy: string | null }[] = [];
  if (campaign.operation_id) {
    const { data } = await assetsRepo.findByOperationId(campaign.operation_id);
    assets = (data ?? [])
      .filter((a) => a.status === "ready")
      .map((a) => ({ id: a.id, type: a.asset_type, title: a.title, copy: a.copy }));
  }

  const creativesJson = campaign.creatives_json;
  if (Array.isArray(creativesJson) && assets.length === 0) {
    assets = creativesJson
      .filter((item) => typeof item === "object" && item !== null && !Array.isArray(item))
      .map((item) => {
        const row = item as Record<string, unknown>;
        return {
          id: typeof row.id === "string" ? row.id : "",
          type: typeof row.type === "string" ? row.type : "image",
          title: typeof row.title === "string" ? row.title : null,
          copy: typeof row.copy === "string" ? row.copy : null,
        };
      })
      .filter((a) => a.id);
  }

  if (assets.length === 0) {
    const { data: adCreative, error } = await creativeRepo.create({
      campaign_id: campaignId,
      creative_asset_id: null,
      headline,
      primary_text: body || headline,
      description: body.slice(0, 200),
      cta: "Saiba mais",
      status: "ready",
      metadata: { source: "copylab", safe_mode: true } as Json,
    });
    return {
      creatives: adCreative ? [adCreative] : [],
      error: error ?? null,
    };
  }

  const created: AdCreative[] = [];
  for (const asset of assets.slice(0, 5)) {
    const { data: adCreative, error } = await creativeRepo.create({
      campaign_id: campaignId,
      creative_asset_id: asset.id || null,
      headline: asset.title ?? headline,
      primary_text: asset.copy ?? body ?? headline,
      description: body.slice(0, 200),
      cta: "Saiba mais",
      status: "ready",
      metadata: { asset_type: asset.type, safe_mode: true } as Json,
    });
    if (adCreative) created.push(adCreative);
    if (error) return { creatives: created, error };
  }

  return { creatives: created, error: null };
}

async function feedAdsCommanderIntegrations(campaign: AdCampaign): Promise<void> {
  const risk = readRiskAnalysis(campaign.metadata);
  const budget = readBudgetSuggestion(campaign.metadata);

  const { registerCampaignResult } = await import("./growth-brain.service");
  void registerCampaignResult({
    operationId: campaign.operation_id,
    campaignId: campaign.id,
    sourcePlatform: campaign.platform,
    country: campaign.country,
    language: campaign.language,
    spend: budget?.daily_max ?? Number(campaign.budget ?? 0),
    metricType: "estimated",
    lesson: `Campanha ${campaign.campaign_name} preparada no Ads Commander`,
    recommendation: "Aprove manualmente — Aura nunca publica automaticamente.",
    metadata: { source: "ads_commander", risk_analysis: risk, campaign_label: campaign.campaign_name },
  }).catch(() => undefined);

  const { registerRevenue } = await import("./revenue-ai.service");
  const { calculateRoas, calculateRoi, calculateProfit } = await import("@/utils/revenue-ai");
  const spend = budget?.monthly_estimate ?? Number(campaign.budget ?? 0) * 30;
  const revenue = spend * 2.5;
  void registerRevenue({
    operationId: campaign.operation_id,
    platform: "ads_commander",
    country: campaign.country ?? "BR",
    currency: "BRL",
    revenue,
    spend,
    roas: calculateRoas(revenue, spend),
    roi: calculateRoi(calculateProfit(revenue, spend), spend),
    metricType: "estimated",
    metadata: { source: "ads_commander", campaign_id: campaign.id },
  }).catch(() => undefined);
}

export async function prepareFullCampaign(params: {
  operationId?: string | null;
  platform?: AdPlatform;
}): Promise<{
  campaign: AdCampaign | null;
  adSets: AdSet[];
  creatives: AdCreative[];
  message: string;
  error: string | null;
}> {
  const { campaign, error: campError } = await prepareCampaign(params);
  if (campError || !campaign) {
    return { campaign: null, adSets: [], creatives: [], message: "", error: campError ?? "Erro." };
  }

  const { adSets, error: setsError } = await prepareAdSets(campaign.id);
  const { creatives, error: creativesError } = await prepareCreatives(campaign.id);
  const { analysis: riskAnalysis } = await generateRiskAnalysis({ campaignId: campaign.id });

  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { campaign, adSets, creatives, message: "", error: "Usuário não autenticado." };
  }

  const repo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
  const { data: updated, error: updateError } = await repo.update(campaign.id, {
    status: "pending_approval",
    approval_required: true,
    metadata: mergeAdsCommanderMetadata(campaign.metadata, {
      risk_analysis: riskAnalysis,
      prepared_at: new Date().toISOString(),
      ad_sets_count: adSets.length,
      creatives_count: creatives.length,
      flow: ["campaign", "ad_sets", "creatives", "risk", "budget", "approval"],
    }),
  });

  if (updated) {
    await feedAdsCommanderIntegrations(updated);
    if (updated.operation_id) {
      await linkAdsCommanderToOperation(updated.operation_id, updated.id);
    }
  }

  const errors = [setsError, creativesError, updateError].filter(Boolean);
  const message = `Campanha preparada: ${adSets.length} conjunto(s), ${creatives.length} anúncio(s). Aguardando aprovação manual.`;

  return {
    campaign: updated ?? campaign,
    adSets,
    creatives,
    message,
    error: errors[0] ?? null,
  };
}

async function linkAdsCommanderToOperation(
  operationId: string,
  campaignId: string
): Promise<void> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const opRepo = new OperationCenterRepository(ctx.supabase, ctx.userId);
  const { data: operation } = await opRepo.findById(operationId);
  if (!operation) return;

  const metadata = mergeAdsCommanderMetadata(operation.metadata, {
    ads_commander_campaign_id: campaignId,
    ads_commander_ready: true,
  });

  await opRepo.update(operationId, { metadata });
}

export async function approveCampaign(campaignId: string): Promise<{
  campaign: AdCampaign | null;
  message: string;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { campaign: null, message: "", error: "Usuário não autenticado." };

  const repo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
  const { data: campaign } = await repo.findById(campaignId);
  if (!campaign) return { campaign: null, message: "", error: "Campanha não encontrada." };

  if (campaign.status !== "pending_approval") {
    return {
      campaign: null,
      message: "",
      error: "Apenas campanhas aguardando aprovação podem ser aprovadas.",
    };
  }

  const { data: updated, error } = await repo.update(campaignId, {
    status: "ready_to_publish",
    approval_required: false,
    metadata: mergeAdsCommanderMetadata(campaign.metadata, {
      approved_at: new Date().toISOString(),
      approved_by: "manual",
      auto_publish: false,
      publish_note: "Status READY_TO_PUBLISH — publique manualmente na plataforma.",
    }),
  });

  if (error || !updated) {
    return { campaign: null, message: "", error: error ?? "Erro ao aprovar campanha." };
  }

  return {
    campaign: updated,
    message:
      "Campanha aprovada — status READY_TO_PUBLISH. Publique manualmente na plataforma (Aura não publica automaticamente).",
    error: null,
  };
}

export async function getAdsCommanderDashboard(): Promise<{
  dashboard: AdsCommanderDashboard | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { dashboard: null, error: "Usuário não autenticado." };

  const campaignRepo = new AdCampaignsRepository(ctx.supabase, ctx.userId);
  const { data: campaigns, error } = await campaignRepo.findAllOrdered();
  if (error) return { dashboard: null, error };

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const setRepo = new AdSetsRepository(ctx.supabase, ctx.userId);
  const creativeRepo = new AdCreativesRepository(ctx.supabase, ctx.userId);

  const [{ data: allSets }, { data: allCreatives }] = await Promise.all([
    setRepo.findAllForUserCampaigns(campaignIds),
    creativeRepo.findAllForUserCampaigns(campaignIds),
  ]);

  const adSetsByCampaign = new Map<string, AdSet[]>();
  for (const set of allSets ?? []) {
    const list = adSetsByCampaign.get(set.campaign_id) ?? [];
    list.push(set);
    adSetsByCampaign.set(set.campaign_id, list);
  }

  const creativesByCampaign = new Map<string, AdCreative[]>();
  for (const creative of allCreatives ?? []) {
    const list = creativesByCampaign.get(creative.campaign_id) ?? [];
    list.push(creative);
    creativesByCampaign.set(creative.campaign_id, list);
  }

  return {
    dashboard: computeAdsCommanderDashboard({
      campaigns: campaigns ?? [],
      adSetsByCampaign,
      creativesByCampaign,
    }),
    error: null,
  };
}

export async function getAdsCommanderContext(): Promise<{
  context: string;
  error: string | null;
}> {
  const { dashboard, error } = await getAdsCommanderDashboard();
  if (error) return { context: "", error };
  if (!dashboard) return { context: "Ads Commander: sem campanhas.", error: null };

  const { buildAdsCommanderAuraContext } = await import("@/utils/ads-commander");
  return { context: buildAdsCommanderAuraContext(dashboard), error: null };
}
