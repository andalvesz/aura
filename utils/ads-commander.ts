import type { AdCampaign, AdCreative, AdSet, Json } from "@/types/database";

export const ADS_COMMANDER_SAFE_MODE = {
  active: true,
  message:
    "Ads Commander prepara campanhas completas — nunca publica anúncios automaticamente. Aprovação manual obrigatória.",
};

export type AdPlatform = "meta" | "google" | "tiktok" | "other";

export type AdCampaignStatus = "draft" | "pending_approval" | "ready_to_publish" | "cancelled";

export type AdSetStatus = "draft" | "ready";

export type AdCreativeStatus = "draft" | "ready";

export const AD_PLATFORMS: { id: AdPlatform; label: string }[] = [
  { id: "meta", label: "Meta Ads" },
  { id: "google", label: "Google Ads" },
  { id: "tiktok", label: "TikTok Ads" },
  { id: "other", label: "Outras plataformas" },
];

export type AudienceSuggestion = {
  name: string;
  type: "interest" | "lookalike" | "remarketing" | "broad";
  targeting: string;
  rationale: string;
  score: number;
};

export type BudgetSuggestion = {
  daily_min: number;
  daily_max: number;
  monthly_estimate: number;
  level: "baixo" | "medio" | "escala";
  rationale: string;
  currency: string;
};

export type RiskAnalysis = {
  overall_risk: number;
  rejection_risk: number;
  budget_risk: number;
  audience_risk: number;
  creative_risk: number;
  warnings: string[];
  recommendations: string[];
};

export type AdsCommanderCampaignSummary = {
  id: string;
  campaign_name: string;
  platform: AdPlatform;
  status: AdCampaignStatus;
  objective: string | null;
  budget: number | null;
  country: string | null;
  language: string | null;
  operation_id: string | null;
  approval_required: boolean;
  ad_sets_count: number;
  creatives_count: number;
  risk_score: number | null;
  created_at: string;
};

export type AdsCommanderDashboard = {
  campanhasPreparadas: number;
  campanhasAguardandoAprovacao: number;
  orcamentoSugerido: number | null;
  melhorPublico: string | null;
  melhorPais: string | null;
  melhorCriativo: string | null;
  safeMode: { active: boolean; message: string };
  campaigns: AdsCommanderCampaignSummary[];
  activeCampaign: AdsCommanderCampaignSummary | null;
  riskAnalysis: RiskAnalysis | null;
  budgetSuggestion: BudgetSuggestion | null;
  audienceSuggestions: AudienceSuggestion[];
};

export function getAdCampaignStatusLabel(status: AdCampaignStatus): string {
  const labels: Record<AdCampaignStatus, string> = {
    draft: "Rascunho",
    pending_approval: "Aguardando aprovação",
    ready_to_publish: "Pronta para publicar",
    cancelled: "Cancelada",
  };
  return labels[status];
}

export function getAdPlatformLabel(platform: AdPlatform): string {
  return AD_PLATFORMS.find((p) => p.id === platform)?.label ?? platform;
}

export function readRiskAnalysis(metadata: unknown): RiskAnalysis | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const risk = (metadata as Record<string, unknown>).risk_analysis;
  if (!risk || typeof risk !== "object" || Array.isArray(risk)) return null;
  const r = risk as Record<string, unknown>;
  return {
    overall_risk: clampNum(r.overall_risk),
    rejection_risk: clampNum(r.rejection_risk),
    budget_risk: clampNum(r.budget_risk),
    audience_risk: clampNum(r.audience_risk),
    creative_risk: clampNum(r.creative_risk),
    warnings: parseStringList(r.warnings),
    recommendations: parseStringList(r.recommendations),
  };
}

export function readBudgetSuggestion(metadata: unknown): BudgetSuggestion | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const budget = (metadata as Record<string, unknown>).budget_suggestion;
  if (!budget || typeof budget !== "object" || Array.isArray(budget)) return null;
  const b = budget as Record<string, unknown>;
  return {
    daily_min: clampNum(b.daily_min),
    daily_max: clampNum(b.daily_max),
    monthly_estimate: clampNum(b.monthly_estimate),
    level: b.level === "baixo" || b.level === "escala" ? b.level : "medio",
    rationale: typeof b.rationale === "string" ? b.rationale : "",
    currency: typeof b.currency === "string" ? b.currency : "BRL",
  };
}

export function readAudienceSuggestions(metadata: unknown): AudienceSuggestion[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const raw = (metadata as Record<string, unknown>).audience_suggestions;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: typeof item.name === "string" ? item.name : "Público",
      type:
        item.type === "lookalike" ||
        item.type === "remarketing" ||
        item.type === "broad"
          ? item.type
          : "interest",
      targeting: typeof item.targeting === "string" ? item.targeting : "",
      rationale: typeof item.rationale === "string" ? item.rationale : "",
      score: clampNum(item.score),
    }));
}

function clampNum(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

function parseStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function computeAdsCommanderDashboard(params: {
  campaigns: AdCampaign[];
  adSetsByCampaign: Map<string, AdSet[]>;
  creativesByCampaign: Map<string, AdCreative[]>;
}): AdsCommanderDashboard {
  const { campaigns, adSetsByCampaign, creativesByCampaign } = params;

  const prepared = campaigns.filter(
    (c) => c.status === "pending_approval" || c.status === "ready_to_publish"
  );
  const awaiting = campaigns.filter((c) => c.status === "pending_approval");

  let orcamentoSugerido: number | null = null;
  let melhorPublico: string | null = null;
  let melhorPais: string | null = null;
  let melhorCriativo: string | null = null;
  let bestAudienceScore = 0;

  for (const campaign of campaigns) {
    const budget = readBudgetSuggestion(campaign.metadata);
    if (budget && (orcamentoSugerido == null || budget.daily_max > orcamentoSugerido)) {
      orcamentoSugerido = budget.daily_max;
    }

    const audiences = readAudienceSuggestions(campaign.metadata);
    for (const aud of audiences) {
      if (aud.score > bestAudienceScore) {
        bestAudienceScore = aud.score;
        melhorPublico = aud.name;
      }
    }

    if (campaign.country && !melhorPais) melhorPais = campaign.country;
    if (campaign.country) melhorPais = campaign.country;

    const creatives = creativesByCampaign.get(campaign.id) ?? [];
    if (creatives.length > 0 && !melhorCriativo) {
      melhorCriativo = creatives[0].headline ?? creatives[0].primary_text ?? null;
    }
  }

  const activeCampaign =
    campaigns.find((c) => c.status === "pending_approval") ??
    campaigns.find((c) => c.status === "draft") ??
    campaigns[0] ??
    null;

  const summaries: AdsCommanderCampaignSummary[] = campaigns.map((c) => {
    const risk = readRiskAnalysis(c.metadata);
    return {
      id: c.id,
      campaign_name: c.campaign_name,
      platform: c.platform as AdPlatform,
      status: c.status as AdCampaignStatus,
      objective: c.objective,
      budget: c.budget != null ? Number(c.budget) : null,
      country: c.country,
      language: c.language,
      operation_id: c.operation_id,
      approval_required: c.approval_required,
      ad_sets_count: adSetsByCampaign.get(c.id)?.length ?? 0,
      creatives_count: creativesByCampaign.get(c.id)?.length ?? 0,
      risk_score: risk?.overall_risk ?? null,
      created_at: c.created_at,
    };
  });

  return {
    campanhasPreparadas: prepared.length,
    campanhasAguardandoAprovacao: awaiting.length,
    orcamentoSugerido,
    melhorPublico,
    melhorPais,
    melhorCriativo,
    safeMode: ADS_COMMANDER_SAFE_MODE,
    campaigns: summaries,
    activeCampaign: activeCampaign
      ? summaries.find((s) => s.id === activeCampaign.id) ?? null
      : null,
    riskAnalysis: activeCampaign ? readRiskAnalysis(activeCampaign.metadata) : null,
    budgetSuggestion: activeCampaign ? readBudgetSuggestion(activeCampaign.metadata) : null,
    audienceSuggestions: activeCampaign ? readAudienceSuggestions(activeCampaign.metadata) : [],
  };
}

export function mergeAdsCommanderMetadata(
  metadata: unknown,
  patch: Record<string, unknown>
): Json {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  return { ...base, ...patch } as Json;
}

export function canApproveCampaign(status: AdCampaignStatus): boolean {
  return status === "pending_approval";
}

export function buildAdsCommanderAuraContext(dashboard: AdsCommanderDashboard): string {
  return [
    "## ADS COMMANDER",
    `Campanhas preparadas: ${dashboard.campanhasPreparadas}`,
    `Aguardando aprovação: ${dashboard.campanhasAguardandoAprovacao}`,
    dashboard.orcamentoSugerido != null
      ? `Orçamento sugerido: R$ ${dashboard.orcamentoSugerido}/dia`
      : null,
    dashboard.melhorPublico ? `Melhor público: ${dashboard.melhorPublico}` : null,
    dashboard.melhorPais ? `Melhor país: ${dashboard.melhorPais}` : null,
    dashboard.safeMode.message,
  ]
    .filter(Boolean)
    .join("\n");
}
