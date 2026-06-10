import type {
  AffiliateAnalysis,
  AffiliateProduct,
  PlatformConnection,
  PlatformSyncLog,
} from "@/types/database";
import type { PlatformAuthType, PlatformId } from "@/lib/platforms/types";

export type { PlatformId, PlatformAuthType };

export type PlatformConnectionStatus = "connected" | "disconnected" | "error";

export type PlatformDefinition = {
  id: PlatformId;
  label: string;
  description: string;
  available: boolean;
  authType: PlatformAuthType;
  credentialFields: { key: string; label: string; type?: "text" | "password" }[];
  comingSoon?: boolean;
};

export const ACTIVE_PLATFORMS: PlatformDefinition[] = [
  {
    id: "kiwify",
    label: "Kiwify",
    description: "Produtos, vendas, comissões e afiliados.",
    available: true,
    authType: "oauth",
    credentialFields: [
      { key: "client_id", label: "Client ID" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "account_id", label: "Account ID (x-kiwify-account-id)" },
    ],
  },
  {
    id: "hotmart",
    label: "Hotmart",
    description: "Histórico de vendas e produtos.",
    available: true,
    authType: "oauth",
    credentialFields: [
      { key: "client_id", label: "Client ID" },
      { key: "client_secret", label: "Client Secret", type: "password" },
      { key: "basic_token", label: "Basic Token", type: "password" },
    ],
  },
  {
    id: "eduzz",
    label: "Eduzz",
    description: "Produtos e vendas via API token.",
    available: true,
    authType: "token",
    credentialFields: [{ key: "api_token", label: "API Token", type: "password" }],
  },
  {
    id: "monetizze",
    label: "Monetizze",
    description: "Produtos e vendas via consumer key.",
    available: true,
    authType: "api_key",
    credentialFields: [
      { key: "consumer_key", label: "Consumer Key" },
      { key: "token", label: "Token", type: "password" },
    ],
  },
];

export const FUTURE_PLATFORMS: PlatformDefinition[] = [
  {
    id: "meta_business",
    label: "Meta Business",
    description: "Anúncios e pixel — em breve.",
    available: false,
    authType: "oauth",
    credentialFields: [],
    comingSoon: true,
  },
  {
    id: "google_ads",
    label: "Google Ads",
    description: "Campanhas e conversões — em breve.",
    available: false,
    authType: "oauth",
    credentialFields: [],
    comingSoon: true,
  },
  {
    id: "tiktok_ads",
    label: "TikTok Ads",
    description: "Performance de anúncios — em breve.",
    available: false,
    authType: "oauth",
    credentialFields: [],
    comingSoon: true,
  },
  {
    id: "stripe",
    label: "Stripe",
    description: "Pagamentos internacionais — em breve.",
    available: false,
    authType: "api_key",
    credentialFields: [],
    comingSoon: true,
  },
  {
    id: "paypal",
    label: "PayPal",
    description: "Checkout global — em breve.",
    available: false,
    authType: "oauth",
    credentialFields: [],
    comingSoon: true,
  },
];

export const ALL_PLATFORM_DEFINITIONS = [...ACTIVE_PLATFORMS, ...FUTURE_PLATFORMS];

export type PlatformConnectionPublic = Omit<
  PlatformConnection,
  "credentials_encrypted"
> & {
  credentialHint?: string;
};

export type PlatformsDashboardMetrics = {
  receitaTotal: number;
  receitaFormatted: string;
  comissoesTotal: number;
  comissoesFormatted: string;
  produtosTotal: number;
  conversaoPct: number;
  conversaoFormatted: string;
  topProduto: string;
  plataformasConectadas: number;
  plataformasTotal: number;
  ultimaSync: string | null;
};

export type AffiliateScoreInsight = {
  produto: string;
  plataforma: string;
  aiScore: number;
  ticketMedio: number;
  potencial: string;
  concorrencia: string;
  legadoCompat: string;
  recomendacao: string;
};

export const PLATFORMS_INTEGRATIONS = [
  { href: "/dashboard/performance", label: "Performance AI" },
  { href: "/dashboard/money", label: "Money Missions" },
  { href: "/dashboard/ceo", label: "Aura CEO" },
  { href: "/dashboard/execution", label: "Execution Engine" },
  { href: "/dashboard/creator", label: "Aura Creator" },
  { href: "/dashboard/legado", label: "Legado" },
] as const;

export const PLATFORMS_IA_ACTIONS = [
  { id: "best-affiliate", label: "Melhores produtos para afiliação" },
  { id: "promote-product", label: "Qual produto promover?" },
  { id: "import-results", label: "Importar meus resultados" },
] as const;

export const PLATFORMS_AI_CONTEXT = `Você é a Aura Platform Hub — central de integrações com plataformas de vendas e afiliados.
Analise produtos, comissões, ticket médio, potencial de venda, concorrência e compatibilidade com o legado do usuário.
Integre dados com Performance AI, Money Missions, Aura CEO e Execution Engine quando relevante.`;

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

const AFFILIATE_BEST_PHRASES = [
  "analise os melhores produtos para afiliacao",
  "melhores produtos para afiliacao",
  "melhores produtos afiliados",
  "produtos para afiliar",
] as const;

const PROMOTE_PRODUCT_PHRASES = [
  "qual produto devo promover",
  "qual produto promover",
  "que produto devo promover",
  "produto devo promover",
] as const;

const IMPORT_RESULTS_PHRASES = [
  "importe meus resultados",
  "importar meus resultados",
  "importar resultados",
  "sincronizar resultados",
  "sincronize meus resultados",
] as const;

export type PlatformsCoachMode =
  | "platforms-affiliate-best"
  | "platforms-promote"
  | "platforms-import";

export function detectPlatformsCoachMode(message: string): PlatformsCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, AFFILIATE_BEST_PHRASES)) return "platforms-affiliate-best";
  if (matchesAny(normalized, PROMOTE_PRODUCT_PHRASES)) return "platforms-promote";
  if (matchesAny(normalized, IMPORT_RESULTS_PHRASES)) return "platforms-import";
  return null;
}

export function platformLabel(platform: PlatformId | string): string {
  return ALL_PLATFORM_DEFINITIONS.find((p) => p.id === platform)?.label ?? platform;
}

export function statusLabel(status: PlatformConnectionStatus): string {
  if (status === "connected") return "Conectado";
  if (status === "error") return "Erro";
  return "Desconectado";
}

export function statusColor(status: PlatformConnectionStatus): string {
  if (status === "connected") return "text-emerald-400 bg-emerald-500/10";
  if (status === "error") return "text-rose-400 bg-rose-500/10";
  return "text-zinc-400 bg-zinc-500/10";
}

export function formatCents(cents: number, currency = "BRL"): string {
  const value = cents / 100;
  if (currency === "BRL") {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency });
}

export function computePlatformsDashboard(params: {
  connections: PlatformConnectionPublic[];
  products: AffiliateProduct[];
  syncLogs: PlatformSyncLog[];
  analyses: AffiliateAnalysis[];
}): PlatformsDashboardMetrics {
  const { connections, products, syncLogs, analyses } = params;

  const connected = connections.filter((c) => c.status === "connected");
  const revenueFromLogs = syncLogs
    .filter((l) => l.status === "success")
    .reduce((sum, l) => {
      const summary = l.payload_summary as { revenueTotalCents?: number } | null;
      return sum + (summary?.revenueTotalCents ?? 0);
    }, 0);

  const commissionsFromLogs = syncLogs
    .filter((l) => l.status === "success")
    .reduce((sum, l) => {
      const summary = l.payload_summary as { commissionsTotalCents?: number } | null;
      return sum + (summary?.commissionsTotalCents ?? 0);
    }, 0);

  const salesCount = syncLogs
    .filter((l) => l.status === "success")
    .reduce((sum, l) => {
      const summary = l.payload_summary as { salesCount?: number } | null;
      return sum + (summary?.salesCount ?? 0);
    }, 0);

  const topAnalysis = analyses
    .filter((a) => a.ai_score != null)
    .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))[0];

  const topProduct =
    topAnalysis?.summary?.split("|")[0]?.trim() ??
    products.sort((a, b) => (b.commission_cents ?? 0) - (a.commission_cents ?? 0))[0]?.name ??
    "—";

  const conversaoPct =
    products.length > 0 ? Math.min(100, Math.round((salesCount / products.length) * 100)) : 0;

  const lastSync = syncLogs[0]?.created_at ?? connected[0]?.last_sync_at ?? null;

  return {
    receitaTotal: revenueFromLogs,
    receitaFormatted: formatCents(revenueFromLogs),
    comissoesTotal: commissionsFromLogs,
    comissoesFormatted: formatCents(commissionsFromLogs),
    produtosTotal: products.length,
    conversaoPct,
    conversaoFormatted: `${conversaoPct}%`,
    topProduto: topProduct,
    plataformasConectadas: connected.length,
    plataformasTotal: ACTIVE_PLATFORMS.length,
    ultimaSync: lastSync,
  };
}

export function buildPlatformsCoachReply(params: {
  mode: PlatformsCoachMode;
  displayName: string;
  dashboard: PlatformsDashboardMetrics | null;
  products: AffiliateProduct[];
  connections: PlatformConnectionPublic[];
  analyses: AffiliateAnalysis[];
}): string {
  const { mode, displayName, dashboard, products, connections, analyses } = params;
  const connected = connections.filter((c) => c.status === "connected");

  if (mode === "platforms-import") {
    if (connected.length === 0) {
      return `Olá, ${displayName}!

Nenhuma plataforma conectada ainda.

1. Abra **Aura Platform Hub** (/dashboard/platforms)
2. Conecte Kiwify, Hotmart, Eduzz ou Monetizze
3. Clique em **Sincronizar** para importar vendas e métricas`;
    }

    return `Olá, ${displayName}!

**Plataformas conectadas:** ${connected.map((c) => platformLabel(c.platform)).join(", ")}

Abra **Aura Platform Hub** (/dashboard/platforms) e clique em **Sincronizar tudo** para importar:
- Produtos e vendas
- Comissões de afiliados
- Métricas para Performance AI e Money Missions

${dashboard?.ultimaSync ? `Última sync: ${new Date(dashboard.ultimaSync).toLocaleString("pt-BR")}` : "Ainda sem sincronização registrada."}`;
  }

  if (mode === "platforms-affiliate-best") {
    const ranked = analyses
      .filter((a) => a.ai_score != null)
      .sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))
      .slice(0, 5);

    if (ranked.length === 0 && products.length === 0) {
      return `Olá, ${displayName}!

Conecte uma plataforma e sincronize em **Aura Platform Hub** (/dashboard/platforms).
Depois, gere o **Score IA** para analisar os melhores produtos para afiliação.`;
    }

    const lines =
      ranked.length > 0
        ? ranked.map(
            (a, i) =>
              `${i + 1}. **Score ${a.ai_score}** — ${a.summary ?? "Produto"} (${platformLabel(a.platform ?? "")})`
          )
        : products.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} (${platformLabel(p.platform)})`);

    return `Olá, ${displayName}!

**Melhores produtos para afiliação (Score IA):**

${lines.join("\n")}

Veja detalhes em **Aura Platform Hub** (/dashboard/platforms).`;
  }

  if (mode === "platforms-promote") {
    const best = analyses.sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))[0];
    const fallback = products.sort(
      (a, b) => (b.commission_cents ?? 0) - (a.commission_cents ?? 0)
    )[0];

    if (!best && !fallback) {
      return `Olá, ${displayName}!

Ainda não há produtos sincronizados. Conecte Kiwify ou outra plataforma em **Aura Platform Hub** (/dashboard/platforms) e sincronize seus dados.`;
    }

    if (best) {
      return `Olá, ${displayName}!

**Recomendação Score IA:** ${best.summary ?? "Produto em destaque"}

- Score: **${best.ai_score}/100**
- Ticket médio: ${best.ticket_medio != null ? formatCents(Math.round(best.ticket_medio * 100)) : "—"}
- Potencial: ${best.potencial_venda != null ? formatCents(Math.round(best.potencial_venda * 100)) : "—"}
- Compatibilidade com legado: ${best.legado_compat ?? "—"}

Promova via Creator + Launch Center e acompanhe em Performance AI.`;
    }

    return `Olá, ${displayName}!

Com base nas comissões sincronizadas, comece promovendo **${fallback.name}** (${platformLabel(fallback.platform)}).

Gere o Score IA completo em **Aura Platform Hub** para uma recomendação estratégica.`;
  }

  return `Olá, ${displayName}! Abra **Aura Platform Hub** (/dashboard/platforms).`;
}

export function buildPlatformsAuraContext(
  dashboard: PlatformsDashboardMetrics,
  products: AffiliateProduct[],
  connections: PlatformConnectionPublic[]
): string {
  const connected = connections
    .filter((c) => c.status === "connected")
    .map((c) => platformLabel(c.platform))
    .join(", ");

  const topProducts = products
    .slice(0, 5)
    .map((p) => `• ${p.name} (${platformLabel(p.platform)})`)
    .join("\n");

  return [
    "## AURA PLATFORM HUB",
    `Receita sincronizada: ${dashboard.receitaFormatted}`,
    `Comissões: ${dashboard.comissoesFormatted}`,
    `Produtos: ${dashboard.produtosTotal}`,
    `Conversão estimada: ${dashboard.conversaoFormatted}`,
    `Top produto: ${dashboard.topProduto}`,
    `Plataformas conectadas: ${dashboard.plataformasConectadas}/${dashboard.plataformasTotal}`,
    connected ? `Ativas: ${connected}` : "Nenhuma plataforma conectada.",
    topProducts ? `Produtos:\n${topProducts}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseAffiliateInsights(value: unknown): AffiliateScoreInsight[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is AffiliateScoreInsight =>
      typeof item === "object" &&
      item != null &&
      typeof (item as AffiliateScoreInsight).produto === "string"
  );
}
