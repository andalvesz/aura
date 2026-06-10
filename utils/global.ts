import type {
  GlobalMarket,
  GlobalResult,
  GlobalStrategy,
} from "@/types/database";
import {
  CREATOR_COUNTRY_OPTIONS,
  CREATOR_CURRENCY_OPTIONS,
  CREATOR_LANGUAGE_OPTIONS,
  formatCreatorMoney,
  getSalesChannels,
  type CreatorCountry,
  type CreatorCurrency,
} from "@/utils/creator-locale";

export type GlobalMarketIntake = {
  country: string;
  language: string;
  currency: string;
  product_type: string;
  objective: "proprio" | "afiliado";
  product_name?: string;
  creator_product_id?: string;
};

export type GlobalDashboardMetrics = {
  mercadosAtivos: number;
  receitaPorMoeda: Record<string, number>;
  receitaPorMoedaFormatted: Record<string, string>;
  receitaTotalConvertida: number;
  receitaTotalFormatted: string;
  melhorMercado: string;
  melhorProduto: string;
  globalScoreMedio: number;
  globalScoreFormatted: string;
};

export type GeneratedMarketStrategy = {
  country: string;
  language: string;
  currency: string;
  suggested_price: number;
  audience: string;
  channels: string[];
  difficulty: "baixa" | "media" | "alta";
  profit_potential: "baixo" | "medio" | "alto";
  profit_potential_score: number;
  score_financial: number;
  score_competition: number;
  score_entry_ease: number;
  score_skills_alignment: number;
  global_score: number;
  ai_summary: string;
};

export type GeneratedGlobalAnalysis = {
  markets: GeneratedMarketStrategy[];
  resumo: string;
  melhor_mercado: string;
  recomendacao: string;
};

export const GLOBAL_PRODUCT_TYPES = [
  { id: "curso", label: "Curso online" },
  { id: "ebook", label: "E-book" },
  { id: "mentoria", label: "Mentoria" },
  { id: "software", label: "Software/SaaS" },
  { id: "afiliado", label: "Produto afiliado" },
  { id: "servico", label: "Serviço" },
  { id: "outro", label: "Outro" },
] as const;

export const GLOBAL_OBJECTIVES = [
  { id: "proprio", label: "Produto próprio" },
  { id: "afiliado", label: "Afiliado" },
] as const;

export const GLOBAL_INTEGRATIONS = [
  { href: "/dashboard/platforms", label: "Platform Hub" },
  { href: "/dashboard/creator", label: "Aura Creator" },
  { href: "/dashboard/creator/research", label: "Market Research" },
  { href: "/dashboard/money", label: "Money Missions" },
  { href: "/dashboard/ceo", label: "Aura CEO" },
] as const;

export const GLOBAL_IA_ACTIONS = [
  { id: "analyze-markets", label: "Analisar mercados internacionais" },
  { id: "best-market", label: "Qual país atacar primeiro?" },
  { id: "currency-compare", label: "Dólar vs Euro?" },
] as const;

export const GLOBAL_AI_CONTEXT = `Você é a Aura Global Intelligence — especialista em estratégia internacional.
Analise países, idiomas, moedas, tipo de produto e objetivo (próprio ou afiliado).
Gere estratégias com preço sugerido, público, canais, dificuldade e potencial de lucro.
Calcule Global Score (0-100) considerando: potencial financeiro, concorrência, facilidade de entrada e alinhamento com habilidades do usuário.
Integre dados de Platform Hub, Creator, Market Research, Money Missions e Aura CEO.`;

/** Taxas aproximadas para BRL (referência interna) */
export const EXCHANGE_RATES_TO_BRL: Record<CreatorCurrency, number> = {
  BRL: 1,
  USD: 5.5,
  EUR: 6.0,
  GBP: 7.0,
  CAD: 4.0,
};

export function convertToBrl(amount: number, currency: string): number {
  const rate = EXCHANGE_RATES_TO_BRL[currency as CreatorCurrency] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

export function formatGlobalMoney(value: number, currency = "BRL"): string {
  return formatCreatorMoney(value, {
    currency: currency as CreatorCurrency,
    target_country: "Brasil",
    target_language: "Português",
  });
}

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

const FIRST_COUNTRY_PHRASES = [
  "qual pais devo atacar primeiro",
  "qual país devo atacar primeiro",
  "que pais atacar primeiro",
  "melhor pais para comecar",
  "primeiro mercado internacional",
  "onde expandir primeiro",
] as const;

const CURRENCY_COMPARE_PHRASES = [
  "vale mais vender em dolar ou euro",
  "vale mais vender em dólar ou euro",
  "dolar ou euro",
  "dólar ou euro",
  "usd ou eur",
  "melhor moeda para vender",
] as const;

const LEGACY_MARKET_PHRASES = [
  "qual mercado combina mais com meu legado",
  "mercado combina com meu legado",
  "mercado combina com legado",
  "mercado internacional e legado",
] as const;

export type GlobalCoachMode =
  | "global-first-country"
  | "global-currency-compare"
  | "global-legacy-market";

export function detectGlobalCoachMode(message: string): GlobalCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, FIRST_COUNTRY_PHRASES)) return "global-first-country";
  if (matchesAny(normalized, CURRENCY_COMPARE_PHRASES)) return "global-currency-compare";
  if (matchesAny(normalized, LEGACY_MARKET_PHRASES)) return "global-legacy-market";
  return null;
}

export function difficultyLabel(d: string): string {
  if (d === "baixa") return "Baixa";
  if (d === "alta") return "Alta";
  return "Média";
}

export function profitLabel(p: string): string {
  if (p === "baixo") return "Baixo";
  if (p === "alto") return "Alto";
  return "Médio";
}

export function difficultyColor(d: string): string {
  if (d === "baixa") return "text-emerald-400 bg-emerald-500/10";
  if (d === "alta") return "text-rose-400 bg-rose-500/10";
  return "text-amber-400 bg-amber-500/10";
}

export function profitColor(p: string): string {
  if (p === "alto") return "text-emerald-400 bg-emerald-500/10";
  if (p === "baixo") return "text-zinc-400 bg-zinc-500/10";
  return "text-amber-400 bg-amber-500/10";
}

export function computeGlobalScore(params: {
  scoreFinancial: number;
  scoreCompetition: number;
  scoreEntryEase: number;
  scoreSkillsAlignment: number;
}): number {
  const { scoreFinancial, scoreCompetition, scoreEntryEase, scoreSkillsAlignment } = params;
  return Math.round(
    scoreFinancial * 0.35 +
      (100 - scoreCompetition) * 0.25 +
      scoreEntryEase * 0.2 +
      scoreSkillsAlignment * 0.2
  );
}

export function computeGlobalDashboard(params: {
  markets: GlobalMarket[];
  strategies: GlobalStrategy[];
  results: GlobalResult[];
}): GlobalDashboardMetrics {
  const { markets, strategies, results } = params;

  const activeMarkets = markets.filter((m) => m.status === "active");
  const receitaPorMoeda: Record<string, number> = {};

  for (const r of results) {
    receitaPorMoeda[r.currency] = (receitaPorMoeda[r.currency] ?? 0) + Number(r.revenue_amount);
  }

  const receitaTotalConvertida = results.reduce(
    (sum, r) => sum + Number(r.revenue_converted_brl ?? convertToBrl(Number(r.revenue_amount), r.currency)),
    0
  );

  const receitaPorMoedaFormatted: Record<string, string> = {};
  for (const [currency, amount] of Object.entries(receitaPorMoeda)) {
    receitaPorMoedaFormatted[currency] = formatGlobalMoney(amount, currency);
  }

  const bestMarket =
    activeMarkets.sort((a, b) => (b.global_score ?? 0) - (a.global_score ?? 0))[0]?.country ??
    markets[0]?.country ??
    "—";

  const productRevenue = new Map<string, number>();
  for (const r of results) {
    const name = r.product_name ?? "Sem nome";
    productRevenue.set(name, (productRevenue.get(name) ?? 0) + Number(r.revenue_converted_brl));
  }
  const melhorProduto =
    [...productRevenue.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    strategies[0]?.audience?.split(".")[0]?.trim() ??
    "—";

  const scores = activeMarkets.filter((m) => m.global_score != null).map((m) => m.global_score!);
  const globalScoreMedio =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return {
    mercadosAtivos: activeMarkets.length,
    receitaPorMoeda,
    receitaPorMoedaFormatted,
    receitaTotalConvertida,
    receitaTotalFormatted: formatGlobalMoney(receitaTotalConvertida, "BRL"),
    melhorMercado: bestMarket,
    melhorProduto,
    globalScoreMedio,
    globalScoreFormatted: `${globalScoreMedio}/100`,
  };
}

export function parseChannels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((c): c is string => typeof c === "string");
}

export function buildGlobalCoachReply(params: {
  mode: GlobalCoachMode;
  displayName: string;
  dashboard: GlobalDashboardMetrics | null;
  markets: GlobalMarket[];
  strategies: GlobalStrategy[];
}): string {
  const { mode, displayName, dashboard, markets, strategies } = params;
  const ranked = [...markets]
    .filter((m) => m.global_score != null)
    .sort((a, b) => (b.global_score ?? 0) - (a.global_score ?? 0));

  if (mode === "global-first-country") {
    if (ranked.length === 0) {
      return `Olá, ${displayName}!

Ainda não há mercados analisados.

1. Abra **Aura Global Intelligence** (/dashboard/global)
2. Informe seu produto e objetivo
3. Clique em **Gerar estratégias** para a IA recomendar o melhor país`;
    }

    const top = ranked[0];
    const strategy = strategies.find((s) => s.market_id === top.id);

    return `Olá, ${displayName}!

**Recomendação Global Score:** ${top.country} — **${top.global_score}/100**

- Idioma: ${top.language}
- Moeda: ${top.currency}
- Objetivo: ${top.objective === "afiliado" ? "Afiliado" : "Produto próprio"}
${strategy ? `- Preço sugerido: ${formatGlobalMoney(Number(strategy.suggested_price ?? 0), strategy.currency)}` : ""}
${strategy?.ai_summary ? `- Estratégia: ${strategy.ai_summary}` : ""}

Veja todos os mercados em **Aura Global Intelligence** (/dashboard/global).`;
  }

  if (mode === "global-currency-compare") {
    const usdMarkets = markets.filter((m) => m.currency === "USD");
    const eurMarkets = markets.filter((m) => m.currency === "EUR");
    const usdScore =
      usdMarkets.length > 0
        ? Math.round(
            usdMarkets.reduce((s, m) => s + (m.global_score ?? 0), 0) / usdMarkets.length
          )
        : null;
    const eurScore =
      eurMarkets.length > 0
        ? Math.round(
            eurMarkets.reduce((s, m) => s + (m.global_score ?? 0), 0) / eurMarkets.length
          )
        : null;

    if (usdScore == null && eurScore == null) {
      return `Olá, ${displayName}!

Gere estratégias em **Aura Global Intelligence** (/dashboard/global) para comparar USD vs EUR com dados reais do seu perfil.

**Referência geral:**
- **USD (EUA):** maior volume, ticket alto, concorrência forte
- **EUR (Europa):** mercados diversos, boa conversão em infoprodutos, regulamentação variável`;
    }

    const winner =
      (usdScore ?? 0) >= (eurScore ?? 0)
        ? `**Dólar (USD)** — score médio ${usdScore}/100`
        : `**Euro (EUR)** — score médio ${eurScore}/100`;

    return `Olá, ${displayName}!

Com base nas suas estratégias geradas:

${winner}

- Mercados USD analisados: ${usdMarkets.length}${usdScore != null ? ` (score ${usdScore})` : ""}
- Mercados EUR analisados: ${eurMarkets.length}${eurScore != null ? ` (score ${eurScore})` : ""}

${dashboard?.receitaPorMoedaFormatted?.USD ? `Receita USD: ${dashboard.receitaPorMoedaFormatted.USD}` : ""}
${dashboard?.receitaPorMoedaFormatted?.EUR ? `Receita EUR: ${dashboard.receitaPorMoedaFormatted.EUR}` : ""}

Detalhes em **Aura Global Intelligence** (/dashboard/global).`;
  }

  if (mode === "global-legacy-market") {
    const legacyAligned = ranked.filter((m) => (m.score_skills_alignment ?? 0) >= 70);

    if (legacyAligned.length === 0 && ranked.length === 0) {
      return `Olá, ${displayName}!

Analise mercados em **Aura Global Intelligence** (/dashboard/global) — a IA cruza seu **Legado** com potencial de cada país.

Enquanto isso, mercados em **inglês** (EUA, Canadá, Reino Unido) costumam combinar com perfis de empreendedorismo digital.`;
    }

    const best = legacyAligned[0] ?? ranked[0];
    return `Olá, ${displayName}!

**Mercado mais alinhado ao seu legado:** ${best.country} — **${best.score_skills_alignment ?? best.global_score}/100** alinhamento

- Global Score: ${best.global_score ?? "—"}/100
- Idioma: ${best.language}
- Potencial financeiro: ${best.score_financial ?? "—"}/100

A IA considerou seu Legado, Creator e Market Research. Veja a estratégia completa em **Aura Global Intelligence** (/dashboard/global).`;
  }

  return `Olá, ${displayName}! Abra **Aura Global Intelligence** (/dashboard/global).`;
}

export function buildGlobalAuraContext(
  dashboard: GlobalDashboardMetrics,
  markets: GlobalMarket[],
  strategies: GlobalStrategy[]
): string {
  const topMarkets = markets
    .slice(0, 5)
    .map((m) => {
      const s = strategies.find((st) => st.market_id === m.id);
      return `• ${m.country} (${m.currency}) — Score ${m.global_score ?? "—"}${s ? ` — ${formatGlobalMoney(Number(s.suggested_price ?? 0), s.currency)}` : ""}`;
    })
    .join("\n");

  const currencyLines = Object.entries(dashboard.receitaPorMoedaFormatted)
    .map(([c, v]) => `${c}: ${v}`)
    .join(", ");

  return [
    "## AURA GLOBAL INTELLIGENCE",
    `Mercados ativos: ${dashboard.mercadosAtivos}`,
    `Receita total (BRL): ${dashboard.receitaTotalFormatted}`,
    currencyLines ? `Receita por moeda: ${currencyLines}` : "",
    `Melhor mercado: ${dashboard.melhorMercado}`,
    `Melhor produto: ${dashboard.melhorProduto}`,
    `Global Score médio: ${dashboard.globalScoreFormatted}`,
    topMarkets ? `Mercados:\n${topMarkets}` : "Nenhum mercado analisado.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function getDefaultMarketCandidates(): {
  country: CreatorCountry;
  language: string;
  currency: CreatorCurrency;
  channels: string[];
}[] {
  return CREATOR_COUNTRY_OPTIONS.filter((c) => c !== "Brasil").map((country) => {
    const currency =
      country === "Estados Unidos"
        ? "USD"
        : country === "Canadá"
          ? "CAD"
          : country === "Reino Unido"
            ? "GBP"
            : "EUR";
    const language =
      country === "Espanha"
        ? "Espanhol"
        : country === "Alemanha"
          ? "Alemão"
          : country === "França"
            ? "Francês"
            : country === "Portugal"
              ? "Português"
              : "Inglês";
    return {
      country,
      language,
      currency,
      channels: getSalesChannels(country),
    };
  });
}

export { CREATOR_COUNTRY_OPTIONS, CREATOR_LANGUAGE_OPTIONS, CREATOR_CURRENCY_OPTIONS };
