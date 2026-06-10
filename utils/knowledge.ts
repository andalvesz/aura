import type {
  KnowledgeConnector,
  KnowledgeEntry,
  KnowledgeInsight,
  KnowledgePattern,
  MarketHistory,
} from "@/types/database";
import { formatCreatorMoney } from "@/utils/creator-locale";

export type KnowledgeDashboardMetrics = {
  entradasTotal: number;
  vencedoresTotal: number;
  insightsAtivos: number;
  conectoresAtivos: number;
  melhorMercado: string;
  melhorCampanha: string;
  melhorMoeda: string;
  vendasPorPais: Record<string, number>;
  vendasPorMoeda: Record<string, number>;
  roasMedioPorMercado: Record<string, number>;
  ctrMedioPorMercado: Record<string, number>;
  conversaoMediaPorMercado: Record<string, number>;
  aprendizadoMes: string;
};

export type KnowledgeConnectorStatus = {
  id: string;
  label: string;
  connector: string;
  href: string;
  status: "connected" | "disconnected" | "coming_soon";
  description: string;
};

export type GeneratedKnowledgeInsights = {
  insights: {
    insight_type: "opportunity" | "risk" | "trend" | "emerging_market";
    title: string;
    summary: string;
    priority: "low" | "medium" | "high";
  }[];
  resumo: string;
};

export const KNOWLEDGE_ENTRY_TYPES = [
  { id: "campaign", label: "Campanha vencedora" },
  { id: "product", label: "Produto vencedor" },
  { id: "copy", label: "Copy vencedora" },
  { id: "audience", label: "Público vencedor" },
  { id: "market", label: "Mercado vencedor" },
  { id: "success", label: "O que funcionou" },
  { id: "failure", label: "O que não funcionou" },
] as const;

export const KNOWLEDGE_CONNECTORS: KnowledgeConnectorStatus[] = [
  {
    id: "platform_hub",
    label: "Platform Hub",
    connector: "platform_hub",
    href: "/dashboard/platforms",
    status: "disconnected",
    description: "Central de integrações Aura",
  },
  {
    id: "meta_business",
    label: "Meta Business",
    connector: "meta_business",
    href: "/dashboard/platforms",
    status: "disconnected",
    description: "Campanhas e métricas Meta",
  },
  {
    id: "kiwify",
    label: "Kiwify",
    connector: "kiwify",
    href: "/dashboard/platforms",
    status: "disconnected",
    description: "Vendas e produtos Kiwify",
  },
  {
    id: "hotmart",
    label: "Hotmart",
    connector: "hotmart",
    href: "/dashboard/platforms",
    status: "disconnected",
    description: "Vendas e afiliados Hotmart",
  },
  {
    id: "eduzz",
    label: "Eduzz",
    connector: "eduzz",
    href: "/dashboard/platforms",
    status: "disconnected",
    description: "Produtos e comissões Eduzz",
  },
  {
    id: "monetizze",
    label: "Monetizze",
    connector: "monetizze",
    href: "/dashboard/platforms",
    status: "disconnected",
    description: "Vendas Monetizze",
  },
  {
    id: "google_analytics",
    label: "Google Analytics",
    connector: "google_analytics",
    href: "/dashboard/knowledge",
    status: "coming_soon",
    description: "Arquitetura preparada",
  },
  {
    id: "google_ads",
    label: "Google Ads",
    connector: "google_ads",
    href: "/dashboard/knowledge",
    status: "coming_soon",
    description: "Arquitetura preparada",
  },
  {
    id: "stripe",
    label: "Stripe",
    connector: "stripe",
    href: "/dashboard/knowledge",
    status: "coming_soon",
    description: "Arquitetura preparada",
  },
  {
    id: "paypal",
    label: "PayPal",
    connector: "paypal",
    href: "/dashboard/knowledge",
    status: "coming_soon",
    description: "Arquitetura preparada",
  },
];

export const KNOWLEDGE_INTEGRATIONS = [
  { href: "/dashboard/platforms", label: "Platform Hub" },
  { href: "/dashboard/global", label: "Global Intelligence" },
  { href: "/dashboard/creator", label: "Aura Creator" },
  { href: "/dashboard/performance", label: "Performance AI" },
  { href: "/dashboard/ceo", label: "Aura CEO" },
] as const;

export const KNOWLEDGE_IA_ACTIONS = [
  { id: "monthly-learning", label: "O que aprendemos este mês?" },
  { id: "best-market", label: "Qual foi nosso melhor mercado?" },
  { id: "best-campaign", label: "Qual foi nossa melhor campanha?" },
  { id: "avoid-errors", label: "Quais erros não devemos repetir?" },
] as const;

export const KNOWLEDGE_AI_CONTEXT = `Você é a Aura Knowledge & Connect — base de conhecimento executiva.
Aprenda com campanhas, produtos, copies, públicos e mercados vencedores.
Registre o que funcionou, o que falhou, países e moedas com melhor performance.
Analise vendas por país/moeda, ROAS, CTR e conversão por mercado.
Gere insights de oportunidades, riscos, tendências e mercados emergentes.
Integre Platform Hub, Meta Business, Kiwify, Hotmart, Eduzz, Monetizze e Global Intelligence.`;

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesAny(text: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => text.includes(normalize(p)));
}

const MONTHLY_LEARNING_PHRASES = [
  "o que aprendemos este mes",
  "o que aprendemos este mês",
  "aprendizado do mes",
  "aprendizado deste mes",
  "resumo do aprendizado",
] as const;

const BEST_MARKET_PHRASES = [
  "qual foi nosso melhor mercado",
  "melhor mercado",
  "qual mercado performou melhor",
  "mercado com melhor performance",
] as const;

const BEST_CAMPAIGN_PHRASES = [
  "qual foi nossa melhor campanha",
  "melhor campanha",
  "campanha vencedora",
  "campanha com melhor resultado",
] as const;

const AVOID_ERRORS_PHRASES = [
  "quais erros nao devemos repetir",
  "quais erros não devemos repetir",
  "erros a evitar",
  "o que nao funcionou",
  "o que não funcionou",
  "nao repetir erros",
] as const;

export type KnowledgeCoachMode =
  | "knowledge-monthly-learning"
  | "knowledge-best-market"
  | "knowledge-best-campaign"
  | "knowledge-avoid-errors";

export function detectKnowledgeCoachMode(message: string): KnowledgeCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, MONTHLY_LEARNING_PHRASES)) return "knowledge-monthly-learning";
  if (matchesAny(normalized, BEST_CAMPAIGN_PHRASES)) return "knowledge-best-campaign";
  if (matchesAny(normalized, AVOID_ERRORS_PHRASES)) return "knowledge-avoid-errors";
  if (matchesAny(normalized, BEST_MARKET_PHRASES)) return "knowledge-best-market";
  return null;
}

export function parseEntryMetrics(value: unknown): {
  revenue?: number;
  roas?: number;
  ctr?: number;
  conversion_rate?: number;
  sales_count?: number;
} {
  if (!value || typeof value !== "object") return {};
  const m = value as Record<string, unknown>;
  return {
    revenue: typeof m.revenue === "number" ? m.revenue : undefined,
    roas: typeof m.roas === "number" ? m.roas : undefined,
    ctr: typeof m.ctr === "number" ? m.ctr : undefined,
    conversion_rate: typeof m.conversion_rate === "number" ? m.conversion_rate : undefined,
    sales_count: typeof m.sales_count === "number" ? m.sales_count : undefined,
  };
}

export function formatKnowledgeMoney(value: number, currency = "BRL"): string {
  return formatCreatorMoney(value, {
    currency: currency as "BRL" | "USD" | "EUR" | "GBP" | "CAD",
    target_country: "Brasil",
    target_language: "Português",
  });
}

export function insightTypeLabel(type: string): string {
  if (type === "opportunity") return "Oportunidade";
  if (type === "risk") return "Risco";
  if (type === "trend") return "Tendência";
  if (type === "emerging_market") return "Mercado emergente";
  return type;
}

export function insightTypeColor(type: string): string {
  if (type === "opportunity") return "text-emerald-400 bg-emerald-500/10";
  if (type === "risk") return "text-rose-400 bg-rose-500/10";
  if (type === "trend") return "text-sky-400 bg-sky-500/10";
  if (type === "emerging_market") return "text-violet-400 bg-violet-500/10";
  return "text-zinc-400 bg-zinc-500/10";
}

export function priorityColor(priority: string): string {
  if (priority === "high") return "text-rose-400 bg-rose-500/10";
  if (priority === "low") return "text-zinc-400 bg-zinc-500/10";
  return "text-amber-400 bg-amber-500/10";
}

function startOfMonthIso(reference = new Date()): string {
  return new Date(reference.getFullYear(), reference.getMonth(), 1).toISOString();
}

export function computeKnowledgeDashboard(params: {
  entries: KnowledgeEntry[];
  insights: KnowledgeInsight[];
  patterns: KnowledgePattern[];
  marketHistory: MarketHistory[];
  connectedPlatforms: string[];
}): KnowledgeDashboardMetrics {
  const { entries, insights, patterns, marketHistory, connectedPlatforms } = params;

  const activeEntries = entries.filter((e) => e.status === "active");
  const winners = activeEntries.filter((e) => e.category === "winner");
  const activeInsights = insights.filter((i) => i.status === "active");

  const vendasPorPais: Record<string, number> = {};
  const vendasPorMoeda: Record<string, number> = {};
  const roasPorMercado: Record<string, number[]> = {};
  const ctrPorMercado: Record<string, number[]> = {};
  const conversaoPorMercado: Record<string, number[]> = {};

  for (const row of marketHistory) {
    const key = row.country || row.market_label || "—";
    vendasPorPais[key] = (vendasPorPais[key] ?? 0) + Number(row.sales_amount);
    vendasPorMoeda[row.currency] = (vendasPorMoeda[row.currency] ?? 0) + Number(row.sales_amount);
    if (row.roas != null) {
      roasPorMercado[key] = [...(roasPorMercado[key] ?? []), Number(row.roas)];
    }
    if (row.ctr != null) {
      ctrPorMercado[key] = [...(ctrPorMercado[key] ?? []), Number(row.ctr)];
    }
    if (row.conversion_rate != null) {
      conversaoPorMercado[key] = [...(conversaoPorMercado[key] ?? []), Number(row.conversion_rate)];
    }
  }

  const avg = (values: number[]) =>
    values.length > 0 ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100 : 0;

  const roasMedioPorMercado = Object.fromEntries(
    Object.entries(roasPorMercado).map(([k, v]) => [k, avg(v)])
  );
  const ctrMedioPorMercado = Object.fromEntries(
    Object.entries(ctrPorMercado).map(([k, v]) => [k, avg(v)])
  );
  const conversaoMediaPorMercado = Object.fromEntries(
    Object.entries(conversaoPorMercado).map(([k, v]) => [k, avg(v)])
  );

  const bestCountryPattern = patterns.find((p) => p.pattern_type === "best_country");
  const bestCampaignPattern = patterns.find((p) => p.pattern_type === "best_campaign");
  const bestCurrencyPattern = patterns.find((p) => p.pattern_type === "best_currency");

  const topMarketEntry = [...winners]
    .filter((e) => e.entry_type === "market" || e.country)
    .sort((a, b) => (b.performance_score ?? 0) - (a.performance_score ?? 0))[0];

  const topCampaignEntry = [...winners]
    .filter((e) => e.entry_type === "campaign")
    .sort((a, b) => (b.performance_score ?? 0) - (a.performance_score ?? 0))[0];

  const monthStart = startOfMonthIso();
  const monthEntries = activeEntries.filter((e) => e.created_at >= monthStart);
  const monthPatterns = patterns.filter((p) => p.created_at >= monthStart);
  const aprendizadoMes =
    monthEntries.length > 0 || monthPatterns.length > 0
      ? `${monthEntries.length} entradas · ${monthPatterns.length} padrões este mês`
      : "Sincronize fontes para começar a aprender";

  return {
    entradasTotal: activeEntries.length,
    vencedoresTotal: winners.length,
    insightsAtivos: activeInsights.length,
    conectoresAtivos: connectedPlatforms.length,
    melhorMercado:
      bestCountryPattern?.label ?? topMarketEntry?.country ?? topMarketEntry?.title ?? "—",
    melhorCampanha: bestCampaignPattern?.label ?? topCampaignEntry?.title ?? "—",
    melhorMoeda: bestCurrencyPattern?.label ?? "—",
    vendasPorPais,
    vendasPorMoeda,
    roasMedioPorMercado,
    ctrMedioPorMercado,
    conversaoMediaPorMercado,
    aprendizadoMes,
  };
}

export function buildKnowledgeAuraContext(
  dashboard: KnowledgeDashboardMetrics,
  entries: KnowledgeEntry[],
  patterns: KnowledgePattern[]
): string {
  const topWinners = entries
    .filter((e) => e.category === "winner" && e.status === "active")
    .slice(0, 5)
    .map((e) => `• ${e.title} (${e.entry_type}, score ${e.performance_score ?? "—"})`)
    .join("\n");

  const topPatterns = patterns
    .slice(0, 5)
    .map((p) => `• ${p.label} (${p.pattern_type}, confiança ${p.confidence_score}%)`)
    .join("\n");

  return [
    "Entradas: " + dashboard.entradasTotal,
    "Vencedores: " + dashboard.vencedoresTotal,
    "Insights ativos: " + dashboard.insightsAtivos,
    "Conectores: " + dashboard.conectoresAtivos,
    "Melhor mercado: " + dashboard.melhorMercado,
    "Melhor campanha: " + dashboard.melhorCampanha,
    "Aprendizado: " + dashboard.aprendizadoMes,
    topWinners ? "Top vencedores:\n" + topWinners : "",
    topPatterns ? "Padrões:\n" + topPatterns : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildKnowledgeCoachReply(params: {
  mode: KnowledgeCoachMode;
  displayName: string;
  dashboard: KnowledgeDashboardMetrics | null;
  entries: KnowledgeEntry[];
  patterns: KnowledgePattern[];
  insights: KnowledgeInsight[];
}): string {
  const { mode, displayName, dashboard, entries, patterns, insights } = params;

  const winners = entries.filter((e) => e.category === "winner" && e.status === "active");
  const failures = entries.filter(
    (e) => e.category === "loser" || e.entry_type === "failure"
  );
  const monthStart = startOfMonthIso();
  const monthEntries = entries.filter((e) => e.created_at >= monthStart);

  if (mode === "knowledge-monthly-learning") {
    if (monthEntries.length === 0 && patterns.length === 0) {
      return `Olá, ${displayName}!

Ainda não há aprendizado registrado este mês.

1. Abra **Aura Knowledge & Connect** (/dashboard/knowledge)
2. Conecte fontes no **Platform Hub**
3. Clique em **Sincronizar e aprender** para a Aura registrar padrões`;
    }

    const worked = patterns.filter((p) => p.pattern_type === "what_worked").slice(0, 3);
    const failed = patterns.filter((p) => p.pattern_type === "what_failed").slice(0, 3);
    const monthInsights = insights.filter((i) => i.created_at >= monthStart).slice(0, 3);

    return `Olá, ${displayName}!

**Aprendizado deste mês:** ${dashboard?.aprendizadoMes ?? "—"}

${worked.length > 0 ? `**O que funcionou:**\n${worked.map((p) => `• ${p.label}`).join("\n")}` : ""}
${failed.length > 0 ? `\n**O que não funcionou:**\n${failed.map((p) => `• ${p.label}`).join("\n")}` : ""}
${monthInsights.length > 0 ? `\n**Insights:**\n${monthInsights.map((i) => `• ${i.title}`).join("\n")}` : ""}

Veja detalhes em **Aura Knowledge & Connect** (/dashboard/knowledge).`;
  }

  if (mode === "knowledge-best-market") {
    const bestMarket = patterns.find((p) => p.pattern_type === "best_market" || p.pattern_type === "best_country");
    const topMarket = winners
      .filter((e) => e.entry_type === "market" || e.country)
      .sort((a, b) => (b.performance_score ?? 0) - (a.performance_score ?? 0))[0];

    if (!bestMarket && !topMarket) {
      return `Olá, ${displayName}!

Sincronize vendas e campanhas em **Aura Knowledge & Connect** (/dashboard/knowledge) para identificar o melhor mercado.`;
    }

    const label = bestMarket?.label ?? topMarket?.title ?? "—";
    const country = bestMarket?.country ?? topMarket?.country ?? "—";
    const score = topMarket?.performance_score;

    return `Olá, ${displayName}!

**Melhor mercado:** ${label}
${country !== "—" ? `- País: ${country}` : ""}
${score != null ? `- Score: ${score}/100` : ""}
${dashboard?.vendasPorPais && Object.keys(dashboard.vendasPorPais).length > 0 ? `- Vendas por país registradas: ${Object.keys(dashboard.vendasPorPais).length}` : ""}

Analise ROAS e conversão em **Aura Knowledge & Connect** (/dashboard/knowledge).`;
  }

  if (mode === "knowledge-best-campaign") {
    const bestCampaign = patterns.find((p) => p.pattern_type === "best_campaign");
    const topCampaign = winners
      .filter((e) => e.entry_type === "campaign")
      .sort((a, b) => (b.performance_score ?? 0) - (a.performance_score ?? 0))[0];

    if (!bestCampaign && !topCampaign) {
      return `Olá, ${displayName}!

Conecte **Meta Business** ou **Platform Hub** e sincronize em **Aura Knowledge & Connect** (/dashboard/knowledge).`;
    }

    const label = bestCampaign?.label ?? topCampaign?.title ?? "—";
    const metrics = topCampaign ? parseEntryMetrics(topCampaign.metrics) : {};

    return `Olá, ${displayName}!

**Melhor campanha:** ${label}
${metrics.roas != null ? `- ROAS: ${metrics.roas}x` : ""}
${metrics.ctr != null ? `- CTR: ${metrics.ctr}%` : ""}
${topCampaign?.performance_score != null ? `- Score: ${topCampaign.performance_score}/100` : ""}

Veja copies e públicos vencedores em **Aura Knowledge & Connect** (/dashboard/knowledge).`;
  }

  if (mode === "knowledge-avoid-errors") {
    if (failures.length === 0) {
      const failedPatterns = patterns.filter((p) => p.pattern_type === "what_failed");
      if (failedPatterns.length === 0) {
        return `Olá, ${displayName}!

Ainda não há erros registrados. Quando algo não funcionar, a Aura aprende automaticamente após sincronizar fontes.`;
      }

      return `Olá, ${displayName}!

**Erros a não repetir:**
${failedPatterns.slice(0, 5).map((p) => `• ${p.label}${p.description ? ` — ${p.description}` : ""}`).join("\n")}

Registre falhas em **Aura Knowledge & Connect** (/dashboard/knowledge).`;
    }

    return `Olá, ${displayName}!

**Erros a não repetir:**
${failures.slice(0, 5).map((e) => `• ${e.title}${e.description ? ` — ${e.description}` : ""}`).join("\n")}

Consulte a Executive Memory em **Aura Knowledge & Connect** (/dashboard/knowledge).`;
  }

  return `Olá, ${displayName}! Abra **Aura Knowledge & Connect** (/dashboard/knowledge).`;
}

export function mapPlatformToConnector(platform: string): KnowledgeConnector {
  const map: Record<string, KnowledgeConnector> = {
    kiwify: "kiwify",
    hotmart: "hotmart",
    eduzz: "eduzz",
    monetizze: "monetizze",
    meta_business: "meta_business",
    google_ads: "google_ads",
    stripe: "stripe",
    paypal: "paypal",
  };
  return map[platform] ?? "platform_hub";
}
