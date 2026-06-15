export type IntegrationPlatformId =
  | "meta"
  | "kiwify"
  | "hotmart"
  | "eduzz"
  | "monetizze"
  | "google_ads"
  | "google_analytics"
  | "stripe"
  | "paypal";

export type IntegrationPlatform = "meta" | "kiwify";

export type IntegrationConnectionStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "coming_soon";

export type IntegrationCenterPlatformStatus = {
  platform: IntegrationPlatformId;
  label: string;
  status: IntegrationConnectionStatus;
  accountLabel: string | null;
  stats: Record<string, number>;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastError: string | null;
  comingSoon: boolean;
};

export const INTEGRATION_SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

export const ACTIVE_INTEGRATIONS: {
  id: IntegrationPlatformId;
  label: string;
  description: string;
  href: string;
}[] = [
  {
    id: "meta",
    label: "Meta Business",
    description: "Campanhas, contas de anúncio e métricas.",
    href: "/dashboard/platforms/meta/intelligence",
  },
  {
    id: "kiwify",
    label: "Kiwify",
    description: "Vendas, produtos, comissões e afiliados.",
    href: "/dashboard/platforms/kiwify",
  },
];

export const COMING_SOON_INTEGRATIONS: IntegrationPlatformId[] = [
  "hotmart",
  "eduzz",
  "monetizze",
  "google_ads",
  "google_analytics",
  "stripe",
  "paypal",
];

export const COMING_SOON_INTEGRATION_LABELS: Record<
  Exclude<IntegrationPlatformId, "meta" | "kiwify">,
  { label: string; description: string }
> = {
  hotmart: { label: "Hotmart", description: "Vendas e produtos digitais." },
  eduzz: { label: "Eduzz", description: "Produtos e vendas via API." },
  monetizze: { label: "Monetizze", description: "Produtos e comissões." },
  google_ads: { label: "Google Ads", description: "Campanhas e conversões." },
  google_analytics: { label: "Google Analytics", description: "Tráfego e eventos." },
  stripe: { label: "Stripe", description: "Pagamentos e assinaturas." },
  paypal: { label: "PayPal", description: "Recebimentos internacionais." },
};

export function integrationPlatformLabel(platform: IntegrationPlatformId | string): string {
  const active = ACTIVE_INTEGRATIONS.find((p) => p.id === platform);
  if (active) return active.label;
  const coming = COMING_SOON_INTEGRATION_LABELS[platform as Exclude<IntegrationPlatformId, "meta" | "kiwify">];
  return coming?.label ?? platform;
}

export function integrationStatusLabel(status: IntegrationConnectionStatus): string {
  if (status === "connected") return "Conectado";
  if (status === "error") return "Erro";
  if (status === "coming_soon") return "Em breve";
  return "Desconectado";
}

export function integrationStatusColor(status: IntegrationConnectionStatus): string {
  if (status === "connected") return "text-emerald-400 bg-emerald-500/10";
  if (status === "error") return "text-rose-400 bg-rose-500/10";
  if (status === "coming_soon") return "text-zinc-500 bg-zinc-500/10";
  return "text-zinc-400 bg-zinc-500/10";
}

export type MetaCampaignAction =
  | "start"
  | "pause"
  | "resume"
  | "duplicate"
  | "generate_copy"
  | "generate_creative";

export const META_ACTIONS_REQUIRING_APPROVAL = [
  "start",
  "publish",
  "increase_budget",
] as const;

export const META_STATUS_LABELS: Record<string, string> = {
  active: "Ativa",
  paused: "Pausada",
  draft: "Rascunho",
  archived: "Arquivada",
  pending_review: "Em revisão",
};

export const INTEGRATION_SECURITY_RULES = [
  "Nunca aumentar orçamento sem aprovação explícita.",
  "Nunca publicar campanha nova sem aprovação.",
  "Campanhas criadas pela Aura começam pausadas.",
  "Todas as ações sensíveis são registradas em logs.",
] as const;

export function formatIntegrationCents(cents: number, currency = "BRL"): string {
  const value = cents / 100;
  if (currency === "USD") return `US$ ${value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export function formatIntegrationDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
