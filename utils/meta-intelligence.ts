import type {
  MetaAd,
  MetaAdSet,
  MetaAudience,
  MetaBusinessManager,
  MetaPage,
  MetaPixel,
} from "@/lib/meta/meta.client";
import type {
  MetaCampaign,
  MetaCampaignMetric,
  MetaConnection,
  MetaInsight,
  MetaRecommendation,
} from "@/types/database";
import { formatIntegrationCents, INTEGRATION_SYNC_INTERVAL_MS } from "@/utils/integrations";

export const META_READ_ONLY_MODE = true;
export const META_SYNC_INTERVAL_MS = INTEGRATION_SYNC_INTERVAL_MS;

export type MetaPerformanceMetrics = {
  ctr: number;
  cpc: number;
  cpm: number;
  cpa: number;
  roas: number;
  frequency: number;
  dailySpendCents: number;
  conversions: number;
  spendCents: number;
  impressions: number;
  clicks: number;
};

export type MetaIntelligenceMetrics = {
  connected: boolean;
  accountLabel: string | null;
  businessName: string | null;
  adAccountsCount: number;
  campaignsCount: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  adSetsCount: number;
  adsCount: number;
  pixelsCount: number;
  activePixelsCount: number;
  audiencesCount: number;
  pagesCount: number;
  businessManagersCount: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  performance: MetaPerformanceMetrics;
  bestCampaign: { id: string; name: string; roas: number; ctr: number } | null;
  worstAd: { id: string; name: string; ctr: number } | null;
};

export type MetaPerformanceInsight = {
  type:
    | "saturated_creative"
    | "low_ctr"
    | "high_cpc"
    | "bad_audience"
    | "promising_campaign"
    | "scale_opportunity"
    | "pause_alert"
    | "revenue_gap";
  title: string;
  summary: string;
  recommendation: string;
  severity: "info" | "warning" | "success" | "critical";
  entityType?: string;
  entityId?: string;
  entityName?: string;
};

export type MetaAutopilotAction = {
  actionType: "generate_creative" | "generate_copy" | "suggest_pause" | "suggest_scale";
  title: string;
  summary: string;
  campaignId?: string;
  requiresApproval: true;
};

export type MetaRevenueCross = {
  investimentoCents: number;
  receitaCents: number;
  lucroCents: number;
  roiPct: number;
  currency: string;
};

export type MetaIntelligencePayload = {
  connection: MetaConnection | null;
  adAccounts?: import("@/types/database").MetaAdAccount[];
  businessManagers: MetaBusinessManager[];
  pages: MetaPage[];
  pixels: MetaPixel[];
  audiences: MetaAudience[];
  adSets: MetaAdSet[];
  ads: MetaAd[];
  campaigns: MetaCampaign[];
  metricsMap: Record<string, MetaCampaignMetric>;
  metrics: MetaIntelligenceMetrics;
  insights: MetaPerformanceInsight[];
  recommendations: MetaAutopilotAction[];
  revenueCross: MetaRevenueCross | null;
  readOnly: boolean;
  connected: boolean;
};

const META_CAMPAIGNS_COUNT_PHRASES = [
  "quantas campanhas tenho",
  "quantas campanhas eu tenho",
  "numero de campanhas",
  "número de campanhas",
  "total de campanhas",
] as const;

const META_CONNECTED_ACCOUNT_PHRASES = [
  "qual conta esta conectada",
  "qual conta está conectada",
  "conta conectada",
  "minha conta meta",
  "meta conectada",
] as const;

const META_ACTIVE_PIXEL_PHRASES = [
  "qual pixel esta ativo",
  "qual pixel está ativo",
  "pixel ativo",
  "meu pixel meta",
  "pixels ativos",
] as const;

const META_BEST_CAMPAIGN_PHRASES = [
  "qual minha melhor campanha",
  "melhor campanha",
  "campanha que mais performa",
  "campanha com melhor roas",
] as const;

const META_BAD_AD_PHRASES = [
  "qual anuncio esta ruim",
  "qual anúncio está ruim",
  "anuncio ruim",
  "anúncio ruim",
  "anuncio com baixo ctr",
  "anúncio com baixo ctr",
] as const;

const META_SPEND_PHRASES = [
  "quanto estou gastando",
  "quanto gasto",
  "gasto diario",
  "gasto diário",
  "quanto gastei",
  "investimento em ads",
] as const;

const META_SCALE_CAMPAIGN_PHRASES = [
  "qual campanha devo escalar",
  "campanha devo escalar",
  "campanha para escalar",
  "escalar campanha",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(text: string, phrases: readonly string[]): boolean {
  const n = normalize(text);
  return phrases.some((p) => n.includes(normalize(p)));
}

export type MetaCoachMode =
  | "meta-campaigns-count"
  | "meta-connected-account"
  | "meta-active-pixel"
  | "meta-best-campaign"
  | "meta-bad-ad"
  | "meta-spend"
  | "meta-scale-campaign";

export function detectMetaCoachMode(message: string): MetaCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, META_BEST_CAMPAIGN_PHRASES)) return "meta-best-campaign";
  if (matchesAny(normalized, META_BAD_AD_PHRASES)) return "meta-bad-ad";
  if (matchesAny(normalized, META_SPEND_PHRASES)) return "meta-spend";
  if (matchesAny(normalized, META_SCALE_CAMPAIGN_PHRASES)) return "meta-scale-campaign";
  if (matchesAny(normalized, META_ACTIVE_PIXEL_PHRASES)) return "meta-active-pixel";
  if (matchesAny(normalized, META_CONNECTED_ACCOUNT_PHRASES)) return "meta-connected-account";
  if (matchesAny(normalized, META_CAMPAIGNS_COUNT_PHRASES)) return "meta-campaigns-count";
  return null;
}

export function computeNextSyncAt(lastSyncAt: string | null): string | null {
  if (!lastSyncAt) return null;
  return new Date(new Date(lastSyncAt).getTime() + META_SYNC_INTERVAL_MS).toISOString();
}

export function shouldAutoSyncMeta(lastSyncAt: string | null): boolean {
  if (!lastSyncAt) return true;
  return Date.now() - new Date(lastSyncAt).getTime() >= META_SYNC_INTERVAL_MS;
}

function aggregatePerformance(
  campaignMetrics: MetaCampaignMetric[]
): MetaPerformanceMetrics {
  if (campaignMetrics.length === 0) {
    return {
      ctr: 0,
      cpc: 0,
      cpm: 0,
      cpa: 0,
      roas: 0,
      frequency: 0,
      dailySpendCents: 0,
      conversions: 0,
      spendCents: 0,
      impressions: 0,
      clicks: 0,
    };
  }

  const totals = campaignMetrics.reduce(
    (acc, m) => ({
      spendCents: acc.spendCents + m.spend_cents,
      impressions: acc.impressions + m.impressions,
      clicks: acc.clicks + m.clicks,
      conversions: acc.conversions + m.conversions,
      roasSum: acc.roasSum + m.roas,
      ctrSum: acc.ctrSum + m.ctr,
      cpaSum: acc.cpaSum + m.cpa,
      frequencySum: acc.frequencySum + m.frequency,
    }),
    { spendCents: 0, impressions: 0, clicks: 0, conversions: 0, roasSum: 0, ctrSum: 0, cpaSum: 0, frequencySum: 0 }
  );

  const count = campaignMetrics.length;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : totals.ctrSum / count;
  const cpc = totals.clicks > 0 ? totals.spendCents / 100 / totals.clicks : 0;
  const cpm = totals.impressions > 0 ? (totals.spendCents / 100 / totals.impressions) * 1000 : 0;
  const cpa = totals.conversions > 0 ? totals.spendCents / 100 / totals.conversions : totals.cpaSum / count;
  const roas = totals.spendCents > 0 ? totals.roasSum / count : 0;
  const frequency = totals.frequencySum / count;
  const dailySpendCents = Math.round(totals.spendCents / 7);

  return {
    ctr: Math.round(ctr * 100) / 100,
    cpc: Math.round(cpc * 100) / 100,
    cpm: Math.round(cpm * 100) / 100,
    cpa: Math.round(cpa * 100) / 100,
    roas: Math.round(roas * 100) / 100,
    frequency: Math.round(frequency * 100) / 100,
    dailySpendCents,
    conversions: totals.conversions,
    spendCents: totals.spendCents,
    impressions: totals.impressions,
    clicks: totals.clicks,
  };
}

function findBestCampaign(
  campaigns: MetaCampaign[],
  metricsMap: Record<string, MetaCampaignMetric>
): MetaIntelligenceMetrics["bestCampaign"] {
  let best: MetaIntelligenceMetrics["bestCampaign"] = null;
  for (const campaign of campaigns) {
    const m = metricsMap[campaign.id];
    if (!m) continue;
    if (!best || m.roas > best.roas || (m.roas === best.roas && m.ctr > best.ctr)) {
      best = { id: campaign.id, name: campaign.name, roas: m.roas, ctr: m.ctr };
    }
  }
  return best;
}

function findWorstAd(ads: MetaAd[]): MetaIntelligenceMetrics["worstAd"] {
  const paused = ads.filter((a) => a.effectiveStatus === "PAUSED" || a.effectiveStatus === "DISAPPROVED");
  const candidate = paused[0] ?? ads.find((a) => a.effectiveStatus !== "ACTIVE");
  if (!candidate) return null;
  return { id: candidate.id, name: candidate.name, ctr: 0 };
}

export function computeMetaIntelligenceMetrics(params: {
  connection: MetaConnection | null;
  adAccountsCount: number;
  campaignsCount: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  businessManagers: MetaBusinessManager[];
  pages: MetaPage[];
  pixels: MetaPixel[];
  audiences: MetaAudience[];
  adSets: MetaAdSet[];
  ads: MetaAd[];
  campaigns: MetaCampaign[];
  metricsMap: Record<string, MetaCampaignMetric>;
}): MetaIntelligenceMetrics {
  const connected = params.connection?.status === "connected";
  const activePixels = params.pixels.filter((p) => !p.isUnavailable && p.lastFiredTime);
  const campaignMetrics = Object.values(params.metricsMap);
  const performance = aggregatePerformance(campaignMetrics);
  const lastSyncAt = params.connection?.last_sync_at ?? null;

  return {
    connected,
    accountLabel: params.connection?.business_name ?? null,
    businessName: params.connection?.business_name ?? null,
    adAccountsCount: params.adAccountsCount,
    campaignsCount: params.campaignsCount,
    activeCampaigns: params.activeCampaigns,
    pausedCampaigns: params.pausedCampaigns,
    adSetsCount: params.adSets.length,
    adsCount: params.ads.length,
    pixelsCount: params.pixels.length,
    activePixelsCount: activePixels.length,
    audiencesCount: params.audiences.length,
    pagesCount: params.pages.length,
    businessManagersCount: params.businessManagers.length,
    lastSyncAt,
    nextSyncAt: computeNextSyncAt(lastSyncAt),
    performance,
    bestCampaign: findBestCampaign(params.campaigns, params.metricsMap),
    worstAd: findWorstAd(params.ads),
  };
}

export function generateMetaPerformanceInsights(params: {
  metrics: MetaIntelligenceMetrics;
  campaigns: MetaCampaign[];
  metricsMap: Record<string, MetaCampaignMetric>;
  ads: MetaAd[];
  adSets: MetaAdSet[];
  audiences: MetaAudience[];
}): MetaPerformanceInsight[] {
  const { metrics, campaigns, metricsMap, ads, adSets, audiences } = params;
  const insights: MetaPerformanceInsight[] = [];
  const perf = metrics.performance;

  if (perf.frequency >= 3) {
    insights.push({
      type: "saturated_creative",
      title: "Criativo saturado",
      summary: `Frequência média de ${perf.frequency}x indica fadiga de criativo.`,
      recommendation: "Gere novos criativos ou rotacione variações para reduzir saturação.",
      severity: "warning",
    });
  }

  if (perf.ctr > 0 && perf.ctr < 0.8) {
    insights.push({
      type: "low_ctr",
      title: "CTR baixo",
      summary: `CTR médio de ${perf.ctr}% está abaixo do benchmark (1%+).`,
      recommendation: "Teste novos hooks visuais e headlines mais diretas no CopyLab.",
      severity: "warning",
    });
  }

  if (perf.cpc > 2) {
    insights.push({
      type: "high_cpc",
      title: "CPC alto",
      summary: `CPC médio de R$ ${perf.cpc.toFixed(2)} está elevado.`,
      recommendation: "Refine segmentação, pause públicos caros e teste lookalikes.",
      severity: "warning",
    });
  }

  const inactiveAudiences = audiences.filter((a) => a.approximateCount < 1000);
  if (inactiveAudiences.length > 0 && audiences.length > 0) {
    insights.push({
      type: "bad_audience",
      title: "Público ruim",
      summary: `${inactiveAudiences.length} público(s) com menos de 1.000 pessoas.`,
      recommendation: "Expanda ou substitua públicos pequenos por interesses mais amplos.",
      severity: "info",
      entityName: inactiveAudiences[0]?.name,
    });
  }

  for (const campaign of campaigns.filter((c) => c.status === "active").slice(0, 5)) {
    const m = metricsMap[campaign.id];
    if (!m) continue;
    if (m.roas >= 2 && m.ctr >= 1) {
      insights.push({
        type: "promising_campaign",
        title: "Campanha promissora",
        summary: `${campaign.name}: ROAS ${m.roas}x e CTR ${m.ctr}%.`,
        recommendation: "Considere escalar orçamento gradualmente (+20% a cada 3 dias).",
        severity: "success",
        entityType: "campaign",
        entityId: campaign.id,
        entityName: campaign.name,
      });
      break;
    }
  }

  if (metrics.bestCampaign && metrics.bestCampaign.roas >= 1.5) {
    insights.push({
      type: "scale_opportunity",
      title: "Oportunidade de escala",
      summary: `${metrics.bestCampaign.name} lidera com ROAS ${metrics.bestCampaign.roas}x.`,
      recommendation: "Aumente orçamento em 15-25% e monitore CPA por 48h.",
      severity: "success",
      entityType: "campaign",
      entityId: metrics.bestCampaign.id,
      entityName: metrics.bestCampaign.name,
    });
  }

  for (const campaign of campaigns) {
    const m = metricsMap[campaign.id];
    if (!m || campaign.status !== "active") continue;
    if (m.roas < 0.5 && m.spend_cents > 5000) {
      insights.push({
        type: "pause_alert",
        title: "Sugerir pausa",
        summary: `${campaign.name} gastou ${formatIntegrationCents(m.spend_cents)} com ROAS ${m.roas}x.`,
        recommendation: "Pause a campanha e revise oferta, página de vendas e criativo.",
        severity: "critical",
        entityType: "campaign",
        entityId: campaign.id,
        entityName: campaign.name,
      });
      break;
    }
  }

  const pausedAds = ads.filter((a) => a.effectiveStatus === "DISAPPROVED" || a.effectiveStatus === "PAUSED");
  if (pausedAds.length > 0 && perf.ctr < 1) {
    insights.push({
      type: "low_ctr",
      title: "Anúncio com baixa performance",
      summary: `${pausedAds[0].name} está pausado/reprovado.`,
      recommendation: "Substitua por novo criativo gerado no Creative Studio.",
      severity: "warning",
      entityType: "ad",
      entityId: pausedAds[0].id,
      entityName: pausedAds[0].name,
    });
  }

  const highFreqAdSets = adSets.filter((s) => s.effectiveStatus === "ACTIVE");
  if (highFreqAdSets.length > 3 && perf.frequency >= 2.5) {
    insights.push({
      type: "saturated_creative",
      title: "Conjuntos com saturação",
      summary: `${highFreqAdSets.length} conjuntos ativos com frequência elevada.`,
      recommendation: "Divida públicos ou crie novos conjuntos com criativos frescos.",
      severity: "warning",
    });
  }

  if (insights.length === 0 && metrics.connected) {
    insights.push({
      type: "promising_campaign",
      title: "Operação estável",
      summary: "Métricas dentro do esperado sem alertas críticos.",
      recommendation: "Mantenha monitoramento e teste variações de copy semanalmente.",
      severity: "info",
    });
  }

  return insights.slice(0, 8);
}

export function generateMetaAutopilotActions(params: {
  insights: MetaPerformanceInsight[];
  campaigns: MetaCampaign[];
  metricsMap: Record<string, MetaCampaignMetric>;
}): MetaAutopilotAction[] {
  const actions: MetaAutopilotAction[] = [];

  for (const insight of params.insights) {
    if (insight.type === "saturated_creative" || insight.type === "low_ctr") {
      actions.push({
        actionType: "generate_creative",
        title: "Gerar novo criativo",
        summary: `${insight.title}: ${insight.summary}`,
        campaignId: insight.entityId,
        requiresApproval: true,
      });
    }
    if (insight.type === "low_ctr" || insight.type === "high_cpc") {
      actions.push({
        actionType: "generate_copy",
        title: "Gerar nova copy",
        summary: `Revisar copy para melhorar CTR/CPC — ${insight.summary}`,
        campaignId: insight.entityId,
        requiresApproval: true,
      });
    }
    if (insight.type === "pause_alert") {
      actions.push({
        actionType: "suggest_pause",
        title: "Sugerir pausa",
        summary: insight.summary,
        campaignId: insight.entityId,
        requiresApproval: true,
      });
    }
    if (insight.type === "scale_opportunity" || insight.type === "promising_campaign") {
      actions.push({
        actionType: "suggest_scale",
        title: "Sugerir escala",
        summary: insight.summary,
        campaignId: insight.entityId,
        requiresApproval: true,
      });
    }
  }

  const seen = new Set<string>();
  return actions
    .filter((a) => {
      const key = `${a.actionType}-${a.campaignId ?? "global"}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

export function computeMetaRevenueCross(params: {
  spendCents: number;
  kiwifyRevenueMonthCents: number;
  currency?: string;
}): MetaRevenueCross {
  const investimentoCents = params.spendCents;
  const receitaCents = params.kiwifyRevenueMonthCents;
  const lucroCents = receitaCents - investimentoCents;
  const roiPct =
    investimentoCents > 0
      ? Math.round(((receitaCents - investimentoCents) / investimentoCents) * 100)
      : receitaCents > 0
        ? 100
        : 0;

  return {
    investimentoCents,
    receitaCents,
    lucroCents,
    roiPct,
    currency: params.currency ?? "BRL",
  };
}

export function buildMetaCoachReply(params: {
  mode: MetaCoachMode;
  displayName: string;
  metrics: MetaIntelligenceMetrics;
  pixels: MetaPixel[];
  insights?: MetaPerformanceInsight[];
}): string {
  const { mode, displayName, metrics, pixels, insights = [] } = params;
  const firstName = displayName.split(" ")[0] ?? displayName;
  const perf = metrics.performance;

  if (!metrics.connected) {
    return `${firstName}, nenhuma conta Meta está conectada. Acesse **Meta Intelligence** em /dashboard/platforms/meta/intelligence e conecte seu Business Manager.`;
  }

  switch (mode) {
    case "meta-campaigns-count":
      return `${firstName}, você tem **${metrics.campaignsCount} campanha(s)** sincronizadas na Meta.

**Ativas:** ${metrics.activeCampaigns}
**Pausadas:** ${metrics.pausedCampaigns}
**Conjuntos:** ${metrics.adSetsCount}
**Anúncios:** ${metrics.adsCount}
**Públicos:** ${metrics.audiencesCount}

Detalhes em /dashboard/platforms/meta/intelligence`;

    case "meta-connected-account":
      return `${firstName}, a conta conectada é **${metrics.accountLabel ?? "Meta Business"}**.

**Business Managers:** ${metrics.businessManagersCount}
**Contas de anúncio:** ${metrics.adAccountsCount}
**Páginas:** ${metrics.pagesCount}
**Última sync:** ${metrics.lastSyncAt ? new Date(metrics.lastSyncAt).toLocaleString("pt-BR") : "—"}

Painel: /dashboard/platforms/meta/intelligence`;

    case "meta-active-pixel": {
      const active = pixels.filter((p) => !p.isUnavailable && p.lastFiredTime);
      if (active.length === 0) {
        return `${firstName}, nenhum Pixel com disparo recente foi encontrado. Você tem **${metrics.pixelsCount} pixel(s)** cadastrado(s) — sincronize em /dashboard/platforms/meta/intelligence.`;
      }
      const top = active[0];
      const list = active
        .slice(0, 3)
        .map((p) => `• **${p.name}** (${p.id})`)
        .join("\n");
      return `${firstName}, **${active.length} pixel(s) ativo(s)** detectado(s).

Principal: **${top.name}**
Último disparo: ${top.lastFiredTime ? new Date(top.lastFiredTime).toLocaleString("pt-BR") : "—"}

${list}

Veja todos em /dashboard/platforms/meta/intelligence`;
    }

    case "meta-best-campaign": {
      const best = metrics.bestCampaign;
      if (!best) {
        return `${firstName}, ainda não há campanhas com métricas suficientes. Sincronize a Meta e aguarde dados de performance.`;
      }
      return `${firstName}, sua **melhor campanha** é **${best.name}**.

**ROAS:** ${best.roas}x
**CTR:** ${best.ctr}%

${insights.find((i) => i.type === "scale_opportunity")?.recommendation ?? "Considere escalar gradualmente o orçamento."}`;
    }

    case "meta-bad-ad": {
      const worst = metrics.worstAd;
      const badInsight = insights.find((i) => i.type === "low_ctr" && i.entityType === "ad");
      if (badInsight) {
        return `${firstName}, o anúncio **${badInsight.entityName}** está com performance ruim.

${badInsight.summary}

**Recomendação:** ${badInsight.recommendation}`;
      }
      if (!worst) {
        return `${firstName}, nenhum anúncio com alerta crítico detectado. CTR médio: ${perf.ctr}%.`;
      }
      return `${firstName}, atenção ao anúncio **${worst.name}** (status não ativo).

Gere um novo criativo no Autopilot — ações requerem sua aprovação.`;
    }

    case "meta-spend":
      return `${firstName}, seu **gasto em ads** (últimos 7 dias):

**Total:** ${formatIntegrationCents(perf.spendCents)}
**Gasto diário médio:** ${formatIntegrationCents(perf.dailySpendCents)}
**CPA:** R$ ${perf.cpa.toFixed(2)}
**ROAS:** ${perf.roas}x

Dashboard: /dashboard/platforms/meta/intelligence`;

    case "meta-scale-campaign": {
      const scaleInsight = insights.find(
        (i) => i.type === "scale_opportunity" || i.type === "promising_campaign"
      );
      const candidate = metrics.bestCampaign;
      if (!candidate && !scaleInsight) {
        return `${firstName}, nenhuma campanha pronta para escalar. Priorize melhorar CTR e ROAS das ativas.`;
      }
      const name = scaleInsight?.entityName ?? candidate?.name ?? "—";
      return `${firstName}, **campanha para escalar:** **${name}**

${scaleInsight?.summary ?? `ROAS ${candidate?.roas}x · CTR ${candidate?.ctr}%`}

**Próximo passo:** ${scaleInsight?.recommendation ?? "Aumente orçamento em 15-20% e monitore por 48h."}

Ação no Autopilot requer sua aprovação.`;
    }
  }
}

export function buildMetaAuraContext(payload: MetaIntelligencePayload): string {
  const { metrics, insights, recommendations, revenueCross } = payload;
  const perf = metrics.performance;

  const lines = [
    "## META INTELLIGENCE",
    `Conectado: ${metrics.connected ? "sim" : "não"}`,
    `Conta: ${metrics.accountLabel ?? "—"}`,
    `Campanhas: ${metrics.campaignsCount} (${metrics.activeCampaigns} ativas)`,
    `Conjuntos: ${metrics.adSetsCount} · Anúncios: ${metrics.adsCount}`,
    `Pixels: ${metrics.pixelsCount} (${metrics.activePixelsCount} ativos) · Públicos: ${metrics.audiencesCount}`,
    `CTR: ${perf.ctr}% · CPC: R$ ${perf.cpc} · CPM: R$ ${perf.cpm}`,
    `CPA: R$ ${perf.cpa} · ROAS: ${perf.roas}x · Frequência: ${perf.frequency}`,
    `Gasto diário: ${formatIntegrationCents(perf.dailySpendCents)} · Conversões: ${perf.conversions}`,
  ];

  if (metrics.bestCampaign) {
    lines.push(`Melhor campanha: ${metrics.bestCampaign.name} (ROAS ${metrics.bestCampaign.roas}x)`);
  }

  if (revenueCross) {
    lines.push(
      `Revenue Center: Investimento ${formatIntegrationCents(revenueCross.investimentoCents)} · Receita Kiwify ${formatIntegrationCents(revenueCross.receitaCents)} · Lucro ${formatIntegrationCents(revenueCross.lucroCents)} · ROI ${revenueCross.roiPct}%`
    );
  }

  if (insights.length > 0) {
    lines.push(
      "Insights:",
      ...insights.slice(0, 4).map((i) => `- ${i.title}: ${i.summary} → ${i.recommendation}`)
    );
  }

  if (recommendations.length > 0) {
    lines.push(
      "Autopilot (pendente aprovação):",
      ...recommendations.slice(0, 3).map((r) => `- ${r.title}: ${r.summary}`)
    );
  }

  return lines.join("\n");
}

export function insightToDbRow(
  insight: MetaPerformanceInsight
): Omit<MetaInsight, "id" | "user_id" | "created_at"> {
  return {
    insight_type: insight.type,
    title: insight.title,
    summary: insight.summary,
    recommendation: insight.recommendation,
    severity: insight.severity,
    entity_type: insight.entityType ?? null,
    entity_id: insight.entityId ?? null,
    entity_name: insight.entityName ?? null,
    metrics_snapshot: {},
    expires_at: null,
  };
}

export function recommendationToDbRow(
  action: MetaAutopilotAction
): Omit<MetaRecommendation, "id" | "user_id" | "created_at" | "updated_at" | "status"> {
  return {
    action_type: action.actionType,
    campaign_id: action.campaignId ?? null,
    title: action.title,
    summary: action.summary,
    details: { source: "performance_ai" },
    requires_approval: true,
  };
}
