import OpenAI from "openai";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import {
  GlobalMarketsRepository,
  GlobalResultsRepository,
  GlobalStrategiesRepository,
} from "@/lib/supabase/repositories/global-intelligence.repository";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import { getMoneyDashboard } from "@/lib/supabase/services/money.service";
import { getPlatformsDashboard } from "@/lib/supabase/services/platform-hub.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import type {
  GlobalMarket,
  GlobalResult,
  GlobalStrategy,
  TableInsert,
} from "@/types/database";
import {
  buildGlobalAuraContext,
  computeGlobalDashboard,
  computeGlobalScore,
  convertToBrl,
  getDefaultMarketCandidates,
  GLOBAL_AI_CONTEXT,
  parseChannels,
  type GeneratedGlobalAnalysis,
  type GlobalDashboardMetrics,
  type GlobalMarketIntake,
} from "@/utils/global";
import { buildAuraContext } from "./aura-brain.service";
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

async function loadGlobalState() {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      markets: [] as GlobalMarket[],
      strategies: [] as GlobalStrategy[],
      results: [] as GlobalResult[],
      error: "Usuário não autenticado.",
    };
  }

  const marketsRepo = new GlobalMarketsRepository(ctx.supabase, ctx.userId);
  const strategiesRepo = new GlobalStrategiesRepository(ctx.supabase, ctx.userId);
  const resultsRepo = new GlobalResultsRepository(ctx.supabase, ctx.userId);

  const [
    { data: markets, error: marketsError },
    { data: strategies, error: strategiesError },
    { data: results, error: resultsError },
  ] = await Promise.all([
    marketsRepo.findAllOrdered(),
    strategiesRepo.findAllOrdered(),
    resultsRepo.findAllOrdered(),
  ]);

  const error = marketsError ?? strategiesError ?? resultsError;
  if (error) {
    return { markets: [], strategies: [], results: [], error };
  }

  return {
    markets: markets ?? [],
    strategies: strategies ?? [],
    results: results ?? [],
    error: null,
  };
}

async function buildIntegrationContext(): Promise<string> {
  const [
    { dashboard: platformsDashboard, products, connections },
    { records: researchRecords },
    { plan: moneyPlan },
    { bundles: creatorBundles },
    legacy,
  ] = await Promise.all([
    getPlatformsDashboard(),
    loadResearchRecords(),
    getMoneyDashboard(),
    loadCreatorBundles(),
    getLegacyContext(),
  ]);

  const creatorSummary =
    creatorBundles.length > 0
      ? creatorBundles
          .slice(0, 5)
          .map(
            (b) =>
              `• ${b.product.nome} (${b.product.nicho ?? "—"}) — ${b.product.target_country ?? "Brasil"}/${b.product.currency ?? "BRL"}`
          )
          .join("\n")
      : "Nenhum produto Creator.";

  return [
    "## PLATFORM HUB",
    platformsDashboard
      ? `Receita: ${platformsDashboard.receitaFormatted} | Produtos: ${platformsDashboard.produtosTotal} | Plataformas: ${platformsDashboard.plataformasConectadas}`
      : "Sem dados de plataformas.",
    products.length > 0
      ? `Top produtos:\n${products.slice(0, 5).map((p) => `• ${p.name} (${p.currency})`).join("\n")}`
      : "",
    connections.filter((c) => c.status === "connected").length > 0
      ? `Conectadas: ${connections.filter((c) => c.status === "connected").map((c) => c.platform).join(", ")}`
      : "",
    "## CREATOR",
    creatorSummary,
    "## MARKET RESEARCH",
    researchRecords.length > 0
      ? researchRecords
          .slice(0, 5)
          .map((r) => `• ${r.nicho ?? r.ideia_input}: nota ${r.nota_final ?? "—"} (${r.target_country ?? "Brasil"})`)
          .join("\n")
      : "Nenhuma pesquisa.",
    "## MONEY MISSIONS",
    moneyPlan
      ? `Meta: ${moneyPlan.valor_meta} ${moneyPlan.currency ?? "BRL"} | Conquistado: ${moneyPlan.valor_conquistado}`
      : "Nenhuma missão ativa.",
    legacy.context ? `## LEGADO\n${legacy.context}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function getGlobalDashboard(): Promise<{
  dashboard: GlobalDashboardMetrics;
  markets: GlobalMarket[];
  strategies: GlobalStrategy[];
  results: GlobalResult[];
  error: string | null;
}> {
  const state = await loadGlobalState();
  if (state.error) {
    return {
      dashboard: computeGlobalDashboard({ markets: [], strategies: [], results: [] }),
      markets: [],
      strategies: [],
      results: [],
      error: state.error,
    };
  }

  return {
    dashboard: computeGlobalDashboard(state),
    markets: state.markets,
    strategies: state.strategies,
    results: state.results,
    error: null,
  };
}

export async function getGlobalContext(): Promise<{ context: string; error: string | null }> {
  const [state, brain] = await Promise.all([loadGlobalState(), buildAuraContext()]);
  if (state.error) return { context: "", error: state.error };

  const dashboard = computeGlobalDashboard(state);
  const globalBlock = buildGlobalAuraContext(dashboard, state.markets, state.strategies);
  return {
    context: [brain.context, globalBlock].filter(Boolean).join("\n\n"),
    error: null,
  };
}

export async function analyzeGlobalMarkets(input: GlobalMarketIntake): Promise<{
  markets: GlobalMarket[];
  strategies: GlobalStrategy[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { markets: [], strategies: [], error: "Usuário não autenticado." };

  const integrationContext = await buildIntegrationContext();
  const candidates = getDefaultMarketCandidates();
  const openai = getOpenAi();

  let generated: GeneratedGlobalAnalysis | null = null;

  if (openai) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${GLOBAL_AI_CONTEXT}

Retorne JSON com:
{
  "markets": [{
    "country": string,
    "language": string,
    "currency": "BRL"|"USD"|"EUR"|"GBP"|"CAD",
    "suggested_price": number,
    "audience": string,
    "channels": string[],
    "difficulty": "baixa"|"media"|"alta",
    "profit_potential": "baixo"|"medio"|"alto",
    "profit_potential_score": number (0-100),
    "score_financial": number (0-100),
    "score_competition": number (0-100),
    "score_entry_ease": number (0-100),
    "score_skills_alignment": number (0-100),
    "global_score": number (0-100),
    "ai_summary": string
  }],
  "resumo": string,
  "melhor_mercado": string,
  "recomendacao": string
}

Analise pelo menos 5 mercados internacionais (exclua Brasil).
Considere: país=${input.country || "auto"}, idioma=${input.language || "auto"}, moeda=${input.currency || "auto"}, produto=${input.product_type}, objetivo=${input.objective}, produto=${input.product_name ?? "não informado"}.`,
        },
        {
          role: "user",
          content: `${integrationContext}\n\nMercados candidatos:\n${JSON.stringify(candidates.slice(0, 8))}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (content) generated = parseJsonBlock<GeneratedGlobalAnalysis>(content);
  }

  if (!generated?.markets?.length) {
    generated = buildFallbackAnalysis(input, candidates);
  }

  const marketsRepo = new GlobalMarketsRepository(ctx.supabase, ctx.userId);
  const strategiesRepo = new GlobalStrategiesRepository(ctx.supabase, ctx.userId);

  const createdMarkets: GlobalMarket[] = [];
  const createdStrategies: GlobalStrategy[] = [];

  for (const item of generated.markets) {
    const globalScore =
      item.global_score ??
      computeGlobalScore({
        scoreFinancial: item.score_financial,
        scoreCompetition: item.score_competition,
        scoreEntryEase: item.score_entry_ease,
        scoreSkillsAlignment: item.score_skills_alignment,
      });

    const marketInsert: Omit<TableInsert<"global_markets">, "user_id"> = {
      country: item.country,
      language: item.language,
      currency: item.currency as TableInsert<"global_markets">["currency"],
      product_type: input.product_type as TableInsert<"global_markets">["product_type"],
      objective: input.objective,
      product_name: input.product_name ?? null,
      creator_product_id: input.creator_product_id ?? null,
      status: "active",
      global_score: globalScore,
      score_financial: item.score_financial,
      score_competition: item.score_competition,
      score_entry_ease: item.score_entry_ease,
      score_skills_alignment: item.score_skills_alignment,
      metadata: { resumo: generated.resumo, melhor_mercado: generated.melhor_mercado },
    };

    const { data: market, error: marketError } = await marketsRepo.create(marketInsert);
    if (marketError || !market) continue;

    createdMarkets.push(market);

    const strategyInsert: Omit<TableInsert<"global_strategies">, "user_id"> = {
      market_id: market.id,
      suggested_price: item.suggested_price,
      currency: item.currency as TableInsert<"global_strategies">["currency"],
      audience: item.audience,
      channels: item.channels,
      difficulty: item.difficulty,
      profit_potential: item.profit_potential,
      profit_potential_score: item.profit_potential_score,
      ai_summary: item.ai_summary,
      raw_analysis: item as unknown as TableInsert<"global_strategies">["raw_analysis"],
      status: "active",
    };

    const { data: strategy, error: strategyError } = await strategiesRepo.create(strategyInsert);
    if (strategy && !strategyError) createdStrategies.push(strategy);
  }

  if (createdMarkets.length === 0) {
    return { markets: [], strategies: [], error: "Não foi possível gerar estratégias." };
  }

  await syncResultsFromIntegrations();

  return { markets: createdMarkets, strategies: createdStrategies, error: null };
}

function buildFallbackAnalysis(
  input: GlobalMarketIntake,
  candidates: ReturnType<typeof getDefaultMarketCandidates>
): GeneratedGlobalAnalysis {
  const markets = candidates.slice(0, 6).map((c, i) => {
    const baseFinancial = 85 - i * 8;
    const baseCompetition = 40 + i * 10;
    const baseEntry = 75 - i * 7;
    const baseSkills = 70 - i * 5;
    const globalScore = computeGlobalScore({
      scoreFinancial: baseFinancial,
      scoreCompetition: baseCompetition,
      scoreEntryEase: baseEntry,
      scoreSkillsAlignment: baseSkills,
    });

    const priceBase =
      c.currency === "USD" ? 97 : c.currency === "EUR" ? 89 : c.currency === "GBP" ? 79 : 147;

    return {
      country: c.country,
      language: c.language,
      currency: c.currency,
      suggested_price: priceBase,
      audience: `Empreendedores digitais em ${c.country} interessados em ${input.product_type}`,
      channels: c.channels.slice(0, 4),
      difficulty: i < 2 ? ("media" as const) : i < 4 ? ("alta" as const) : ("baixa" as const),
      profit_potential: i < 2 ? ("alto" as const) : ("medio" as const),
      profit_potential_score: Math.max(50, 90 - i * 8),
      score_financial: baseFinancial,
      score_competition: baseCompetition,
      score_entry_ease: baseEntry,
      score_skills_alignment: baseSkills,
      global_score: globalScore,
      ai_summary: `Mercado ${c.country}: potencial ${input.objective === "afiliado" ? "de afiliação" : "para produto próprio"} em ${c.language}.`,
    };
  });

  const best = markets.sort((a, b) => b.global_score - a.global_score)[0];

  return {
    markets,
    resumo: `Análise internacional para ${input.product_type} (${input.objective}).`,
    melhor_mercado: best.country,
    recomendacao: `Priorize ${best.country} com Global Score ${best.global_score}.`,
  };
}

export async function syncResultsFromIntegrations(): Promise<{ synced: number; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { synced: 0, error: "Usuário não autenticado." };

  const { dashboard: platformsDashboard, products } = await getPlatformsDashboard();
  const { markets } = await loadGlobalState();
  const resultsRepo = new GlobalResultsRepository(ctx.supabase, ctx.userId);

  let synced = 0;

  const currencyTotals = new Map<string, { amount: number; products: string[] }>();

  for (const product of products) {
    const currency = (product.currency ?? "BRL") as string;
    const amount = (product.price_cents ?? product.commission_cents ?? 0) / 100;
    if (amount <= 0) continue;

    const existing = currencyTotals.get(currency) ?? { amount: 0, products: [] };
    existing.amount += amount;
    existing.products.push(product.name);
    currencyTotals.set(currency, existing);
  }

  if (platformsDashboard.receitaTotal > 0) {
    const amount = platformsDashboard.receitaTotal / 100;
    const existing = currencyTotals.get("BRL") ?? { amount: 0, products: [] };
    existing.amount += amount;
    currencyTotals.set("BRL", existing);
  }

  for (const [currency, { amount, products: productNames }] of currencyTotals) {
    const matchingMarket = markets.find((m) => m.currency === currency && m.status === "active");

    const { error } = await resultsRepo.create({
      market_id: matchingMarket?.id ?? null,
      strategy_id: null,
      currency: currency as TableInsert<"global_results">["currency"],
      revenue_amount: amount,
      revenue_converted_brl: convertToBrl(amount, currency),
      product_name: productNames[0] ?? null,
      source: "platform_hub",
      metadata: { product_count: productNames.length, synced_at: new Date().toISOString() },
    });

    if (!error) synced += 1;
  }

  return { synced, error: null };
}

export async function deleteGlobalMarket(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new GlobalMarketsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}

export async function getGlobalIaReply(params: {
  message: string;
  actionId?: string;
}): Promise<{ text: string; error: string | null }> {
  const [{ dashboard, markets, strategies, error }, brain, integrationContext] =
    await Promise.all([
      getGlobalDashboard(),
      buildAuraContext(),
      buildIntegrationContext(),
    ]);
  if (error) return { text: "", error };

  const openai = getOpenAi();
  const context = [brain.context, buildGlobalAuraContext(dashboard, markets, strategies)]
    .filter(Boolean)
    .join("\n\n");

  if (!openai) {
    const best = markets.sort((a, b) => (b.global_score ?? 0) - (a.global_score ?? 0))[0];
    if (params.actionId === "best-market" && best) {
      return {
        text: `**${best.country}** — Global Score **${best.global_score}/100**`,
        error: null,
      };
    }
    return {
      text: best
        ? `Melhor mercado: **${best.country}** (${best.global_score}/100)`
        : "Gere estratégias internacionais para começar.",
      error: null,
    };
  }

  const actionHint =
    params.actionId === "analyze-markets"
      ? "Analise mercados internacionais e recomende estratégias."
      : params.actionId === "best-market"
        ? "Recomende qual país atacar primeiro e por quê."
        : params.actionId === "currency-compare"
          ? "Compare vender em dólar vs euro para o perfil do usuário."
          : "";

  const strategyDetails = strategies.slice(0, 8).map((s) => {
    const market = markets.find((m) => m.id === s.market_id);
    return {
      country: market?.country,
      price: s.suggested_price,
      currency: s.currency,
      audience: s.audience,
      channels: parseChannels(s.channels),
      difficulty: s.difficulty,
      profit: s.profit_potential,
      summary: s.ai_summary,
    };
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${GLOBAL_AI_CONTEXT} ${actionHint}
Responda em markdown, português do Brasil.`,
      },
      {
        role: "user",
        content: `${context}\n\n${integrationContext}\n\nEstratégias:\n${JSON.stringify(strategyDetails)}\n\nPergunta: ${params.message}`,
      },
    ],
    temperature: 0.7,
  });

  return {
    text: response.choices[0]?.message?.content ?? "Sem resposta.",
    error: null,
  };
}
