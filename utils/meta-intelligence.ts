import type {
  MetaAd,
  MetaAdSet,
  MetaBusinessManager,
  MetaPage,
  MetaPixel,
} from "@/lib/meta/meta.client";
import type { MetaConnection } from "@/types/database";

export const META_READ_ONLY_MODE = true;

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
  pagesCount: number;
  businessManagersCount: number;
  lastSyncAt: string | null;
};

export type MetaIntelligencePayload = {
  connection: MetaConnection | null;
  businessManagers: MetaBusinessManager[];
  pages: MetaPage[];
  pixels: MetaPixel[];
  adSets: MetaAdSet[];
  ads: MetaAd[];
  metrics: MetaIntelligenceMetrics;
  readOnly: boolean;
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
  | "meta-active-pixel";

export function detectMetaCoachMode(message: string): MetaCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, META_ACTIVE_PIXEL_PHRASES)) return "meta-active-pixel";
  if (matchesAny(normalized, META_CONNECTED_ACCOUNT_PHRASES)) return "meta-connected-account";
  if (matchesAny(normalized, META_CAMPAIGNS_COUNT_PHRASES)) return "meta-campaigns-count";
  return null;
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
  adSets: MetaAdSet[];
  ads: MetaAd[];
}): MetaIntelligenceMetrics {
  const connected = params.connection?.status === "connected";
  const activePixels = params.pixels.filter(
    (p) => !p.isUnavailable && p.lastFiredTime
  );

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
    pagesCount: params.pages.length,
    businessManagersCount: params.businessManagers.length,
    lastSyncAt: params.connection?.last_sync_at ?? null,
  };
}

export function buildMetaCoachReply(params: {
  mode: MetaCoachMode;
  displayName: string;
  metrics: MetaIntelligenceMetrics;
  pixels: MetaPixel[];
}): string {
  const { mode, displayName, metrics, pixels } = params;
  const firstName = displayName.split(" ")[0] ?? displayName;

  if (!metrics.connected) {
    return `${firstName}, nenhuma conta Meta está conectada. Acesse **Meta Connect** em /dashboard/platforms/meta e conecte seu Business Manager.`;
  }

  switch (mode) {
    case "meta-campaigns-count":
      return `${firstName}, você tem **${metrics.campaignsCount} campanha(s)** sincronizadas na Meta.

**Ativas:** ${metrics.activeCampaigns}
**Pausadas:** ${metrics.pausedCampaigns}
**Conjuntos:** ${metrics.adSetsCount}
**Anúncios:** ${metrics.adsCount}

Detalhes em /dashboard/platforms/meta`;

    case "meta-connected-account":
      return `${firstName}, a conta conectada é **${metrics.accountLabel ?? "Meta Business"}**.

**Business Managers:** ${metrics.businessManagersCount}
**Contas de anúncio:** ${metrics.adAccountsCount}
**Páginas:** ${metrics.pagesCount}
**Última sync:** ${metrics.lastSyncAt ? new Date(metrics.lastSyncAt).toLocaleString("pt-BR") : "—"}

Painel: /dashboard/platforms/meta`;

    case "meta-active-pixel": {
      const active = pixels.filter((p) => !p.isUnavailable && p.lastFiredTime);
      if (active.length === 0) {
        return `${firstName}, nenhum Pixel com disparo recente foi encontrado. Você tem **${metrics.pixelsCount} pixel(s)** cadastrado(s) — sincronize em /dashboard/platforms/meta.`;
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

Veja todos em /dashboard/platforms/meta`;
    }
  }
}

export function buildMetaAuraContext(payload: MetaIntelligencePayload): string {
  const { metrics } = payload;
  return [
    "## META CONNECT (READ ONLY)",
    `Conectado: ${metrics.connected ? "sim" : "não"}`,
    `Conta: ${metrics.accountLabel ?? "—"}`,
    `Business Managers: ${metrics.businessManagersCount}`,
    `Contas de anúncio: ${metrics.adAccountsCount}`,
    `Páginas: ${metrics.pagesCount}`,
    `Pixels: ${metrics.pixelsCount} (${metrics.activePixelsCount} ativos)`,
    `Campanhas: ${metrics.campaignsCount} (${metrics.activeCampaigns} ativas)`,
    `Conjuntos: ${metrics.adSetsCount}`,
    `Anúncios: ${metrics.adsCount}`,
  ].join("\n");
}
