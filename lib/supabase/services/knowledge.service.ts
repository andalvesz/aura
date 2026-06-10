import OpenAI from "openai";
import {
  KnowledgeEntriesRepository,
  KnowledgeInsightsRepository,
  KnowledgePatternsRepository,
  MarketHistoryRepository,
} from "@/lib/supabase/repositories/knowledge.repository";
import { getGlobalDashboard } from "@/lib/supabase/services/global-intelligence.service";
import { getPlatformsDashboard } from "@/lib/supabase/services/platform-hub.service";
import type {
  KnowledgeConnector,
  KnowledgeEntry,
  KnowledgeInsight,
  KnowledgePattern,
  KnowledgePatternType,
  MarketHistory,
  TableInsert,
} from "@/types/database";
import {
  buildKnowledgeAuraContext,
  computeKnowledgeDashboard,
  KNOWLEDGE_AI_CONTEXT,
  mapPlatformToConnector,
  parseEntryMetrics,
  type GeneratedKnowledgeInsights,
  type KnowledgeConnectorStatus,
  type KnowledgeDashboardMetrics,
  KNOWLEDGE_CONNECTORS,
} from "@/utils/knowledge";
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

async function loadKnowledgeState() {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      entries: [] as KnowledgeEntry[],
      insights: [] as KnowledgeInsight[],
      patterns: [] as KnowledgePattern[],
      marketHistory: [] as MarketHistory[],
      error: "Usuário não autenticado.",
    };
  }

  const entriesRepo = new KnowledgeEntriesRepository(ctx.supabase, ctx.userId);
  const insightsRepo = new KnowledgeInsightsRepository(ctx.supabase, ctx.userId);
  const patternsRepo = new KnowledgePatternsRepository(ctx.supabase, ctx.userId);
  const historyRepo = new MarketHistoryRepository(ctx.supabase, ctx.userId);

  const [
    { data: entries, error: entriesError },
    { data: insights, error: insightsError },
    { data: patterns, error: patternsError },
    { data: marketHistory, error: historyError },
  ] = await Promise.all([
    entriesRepo.findAllOrdered(),
    insightsRepo.findAllOrdered(),
    patternsRepo.findAllOrdered(),
    historyRepo.findAllOrdered(),
  ]);

  const error = entriesError ?? insightsError ?? patternsError ?? historyError;
  if (error) {
    return { entries: [], insights: [], patterns: [], marketHistory: [], error };
  }

  return {
    entries: entries ?? [],
    insights: insights ?? [],
    patterns: patterns ?? [],
    marketHistory: marketHistory ?? [],
    error: null,
  };
}

function buildConnectorStatuses(
  connectedPlatforms: string[]
): KnowledgeConnectorStatus[] {
  const connectedSet = new Set(connectedPlatforms);
  const hasPlatformHub = connectedSet.size > 0;

  return KNOWLEDGE_CONNECTORS.map((c) => {
    if (c.status === "coming_soon") return c;
    if (c.connector === "platform_hub") {
      return { ...c, status: hasPlatformHub ? "connected" : "disconnected" };
    }
    const platformKey = c.connector;
    return {
      ...c,
      status: connectedSet.has(platformKey) ? "connected" : "disconnected",
    };
  });
}

async function rebuildPatternsFromData(
  entries: KnowledgeEntry[],
  marketHistory: MarketHistory[],
  patternsRepo: KnowledgePatternsRepository
): Promise<void> {
  const winners = entries.filter((e) => e.category === "winner" && e.status === "active");
  const losers = entries.filter(
    (e) => e.category === "loser" || e.entry_type === "failure"
  );

  const patternTypes: KnowledgePatternType[] = [
    "what_worked",
    "what_failed",
    "best_country",
    "best_currency",
    "best_campaign",
    "best_market",
  ];

  for (const pt of patternTypes) {
    await patternsRepo.deleteByPatternType(pt);
  }

  for (const entry of winners.slice(0, 10)) {
    await patternsRepo.create({
      pattern_type: "what_worked",
      label: entry.title,
      description: entry.description,
      country: entry.country,
      currency: entry.currency,
      confidence_score: entry.performance_score ?? 60,
      evidence_count: 1,
      metrics: entry.metrics,
      metadata: { entry_id: entry.id, entry_type: entry.entry_type },
    });
  }

  for (const entry of losers.slice(0, 10)) {
    await patternsRepo.create({
      pattern_type: "what_failed",
      label: entry.title,
      description: entry.description,
      country: entry.country,
      currency: entry.currency,
      confidence_score: 70,
      evidence_count: 1,
      metrics: entry.metrics,
      metadata: { entry_id: entry.id },
    });
  }

  const countryTotals = new Map<string, { amount: number; count: number }>();
  const currencyTotals = new Map<string, { amount: number; count: number }>();

  for (const row of marketHistory) {
    const countryKey = row.country;
    const existing = countryTotals.get(countryKey) ?? { amount: 0, count: 0 };
    existing.amount += Number(row.sales_amount);
    existing.count += row.sales_count;
    countryTotals.set(countryKey, existing);

    const curExisting = currencyTotals.get(row.currency) ?? { amount: 0, count: 0 };
    curExisting.amount += Number(row.sales_amount);
    curExisting.count += row.sales_count;
    currencyTotals.set(row.currency, curExisting);
  }

  const topCountry = [...countryTotals.entries()].sort((a, b) => b[1].amount - a[1].amount)[0];
  if (topCountry) {
    await patternsRepo.create({
      pattern_type: "best_country",
      label: topCountry[0],
      description: `Vendas: ${topCountry[1].amount.toFixed(2)} (${topCountry[1].count} transações)`,
      country: topCountry[0],
      confidence_score: 75,
      evidence_count: topCountry[1].count,
      metrics: { sales_amount: topCountry[1].amount, sales_count: topCountry[1].count },
    });
    await patternsRepo.create({
      pattern_type: "best_market",
      label: topCountry[0],
      description: "Melhor mercado por volume de vendas",
      country: topCountry[0],
      confidence_score: 75,
      evidence_count: topCountry[1].count,
      metrics: { sales_amount: topCountry[1].amount },
    });
  }

  const topCurrency = [...currencyTotals.entries()].sort((a, b) => b[1].amount - a[1].amount)[0];
  if (topCurrency) {
    await patternsRepo.create({
      pattern_type: "best_currency",
      label: topCurrency[0],
      description: `Receita total: ${topCurrency[1].amount.toFixed(2)}`,
      currency: topCurrency[0] as TableInsert<"knowledge_patterns">["currency"],
      confidence_score: 70,
      evidence_count: topCurrency[1].count,
      metrics: { sales_amount: topCurrency[1].amount },
    });
  }

  const topCampaign = winners
    .filter((e) => e.entry_type === "campaign")
    .sort((a, b) => (b.performance_score ?? 0) - (a.performance_score ?? 0))[0];

  if (topCampaign) {
    await patternsRepo.create({
      pattern_type: "best_campaign",
      label: topCampaign.title,
      description: topCampaign.description,
      country: topCampaign.country,
      currency: topCampaign.currency,
      confidence_score: topCampaign.performance_score ?? 65,
      evidence_count: 1,
      metrics: topCampaign.metrics,
      metadata: { entry_id: topCampaign.id },
    });
  }
}

function buildFallbackInsights(
  entries: KnowledgeEntry[],
  marketHistory: MarketHistory[]
): GeneratedKnowledgeInsights {
  const insights: GeneratedKnowledgeInsights["insights"] = [];

  const winners = entries.filter((e) => e.category === "winner");
  if (winners.length > 0) {
    insights.push({
      insight_type: "opportunity",
      title: "Replicar vencedores",
      summary: `${winners.length} entradas vencedoras podem ser escaladas em novos mercados.`,
      priority: "high",
    });
  }

  const failures = entries.filter((e) => e.category === "loser" || e.entry_type === "failure");
  if (failures.length > 0) {
    insights.push({
      insight_type: "risk",
      title: "Evitar padrões de falha",
      summary: `${failures.length} registros indicam erros a não repetir.`,
      priority: "medium",
    });
  }

  const countries = new Set(marketHistory.map((m) => m.country));
  if (countries.size >= 2) {
    insights.push({
      insight_type: "trend",
      title: "Expansão multi-país",
      summary: `Dados em ${countries.size} países — compare ROAS e conversão por mercado.`,
      priority: "medium",
    });
  }

  const emerging = marketHistory
    .filter((m) => Number(m.sales_amount) > 0)
    .slice(0, 1)[0];

  if (emerging) {
    insights.push({
      insight_type: "emerging_market",
      title: `Mercado ${emerging.country}`,
      summary: `Vendas registradas em ${emerging.country} (${emerging.currency}) — candidato a escala.`,
      priority: "low",
    });
  }

  return {
    insights,
    resumo: insights.length > 0 ? "Insights gerados a partir dos dados sincronizados." : "Sincronize fontes para gerar insights.",
  };
}

export async function getKnowledgeDashboard(): Promise<{
  dashboard: KnowledgeDashboardMetrics;
  entries: KnowledgeEntry[];
  insights: KnowledgeInsight[];
  patterns: KnowledgePattern[];
  marketHistory: MarketHistory[];
  connectors: KnowledgeConnectorStatus[];
  error: string | null;
}> {
  const state = await loadKnowledgeState();
  if (state.error) {
    return {
      dashboard: computeKnowledgeDashboard({
        entries: [],
        insights: [],
        patterns: [],
        marketHistory: [],
        connectedPlatforms: [],
      }),
      entries: [],
      insights: [],
      patterns: [],
      marketHistory: [],
      connectors: KNOWLEDGE_CONNECTORS,
      error: state.error,
    };
  }

  const { connections } = await getPlatformsDashboard();
  const connectedPlatforms = connections
    .filter((c) => c.status === "connected")
    .map((c) => c.platform);

  const dashboard = computeKnowledgeDashboard({
    entries: state.entries,
    insights: state.insights,
    patterns: state.patterns,
    marketHistory: state.marketHistory,
    connectedPlatforms,
  });

  return {
    dashboard,
    entries: state.entries,
    insights: state.insights,
    patterns: state.patterns,
    marketHistory: state.marketHistory,
    connectors: buildConnectorStatuses(connectedPlatforms),
    error: null,
  };
}

export async function getKnowledgeContext(): Promise<{ context: string; error: string | null }> {
  const [{ dashboard, entries, patterns, error }, brain] = await Promise.all([
    getKnowledgeDashboard(),
    buildAuraContext(),
  ]);
  if (error) return { context: "", error };
  const knowledgeBlock = buildKnowledgeAuraContext(dashboard, entries, patterns);
  return {
    context: [brain.context, knowledgeBlock].filter(Boolean).join("\n\n"),
    error: null,
  };
}

export async function syncKnowledgeFromIntegrations(): Promise<{
  synced: number;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { synced: 0, error: "Usuário não autenticado." };

  const entriesRepo = new KnowledgeEntriesRepository(ctx.supabase, ctx.userId);
  const historyRepo = new MarketHistoryRepository(ctx.supabase, ctx.userId);
  const patternsRepo = new KnowledgePatternsRepository(ctx.supabase, ctx.userId);

  const [{ products, connections, dashboard: platformsDashboard }, { markets, results }] =
    await Promise.all([getPlatformsDashboard(), getGlobalDashboard()]);

  let synced = 0;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  for (const product of products) {
    const connector = mapPlatformToConnector(product.platform) as KnowledgeConnector;
    const sourceRef = `product:${product.platform}:${product.external_product_id}`;
    const existing = await entriesRepo.findBySourceRef(sourceRef, connector);
    if (existing.data) continue;

    const price = (product.price_cents ?? product.commission_cents ?? 0) / 100;
    const score = price > 500 ? 80 : price > 100 ? 65 : 50;

    const { error } = await entriesRepo.create({
      entry_type: "product",
      category: price > 0 ? "winner" : "neutral",
      connector,
      title: product.name,
      description: `Produto ${product.platform} — comissão ${product.commission_pct ?? "—"}%`,
      country: "Brasil",
      currency: (product.currency ?? "BRL") as TableInsert<"knowledge_entries">["currency"],
      performance_score: score,
      metrics: {
        revenue: price,
        commission_pct: product.commission_pct,
      },
      source_ref: sourceRef,
      metadata: { platform: product.platform, affiliate_enabled: product.affiliate_enabled },
    });

    if (!error) synced += 1;
  }

  for (const conn of connections.filter((c) => c.status === "connected")) {
    const connector = mapPlatformToConnector(conn.platform) as KnowledgeConnector;
    const sourceRef = `connection:${conn.platform}:${conn.id}`;
    const existing = await entriesRepo.findBySourceRef(sourceRef, connector);
    if (existing.data) continue;

    const { error } = await entriesRepo.create({
      entry_type: "success",
      category: "winner",
      connector,
      title: `Conexão ${conn.platform}`,
      description: conn.account_label ?? "Integração ativa",
      performance_score: 70,
      metrics: { connected: true },
      source_ref: sourceRef,
      metadata: { platform: conn.platform, last_sync_at: conn.last_sync_at },
    });

    if (!error) synced += 1;
  }

  if (platformsDashboard.receitaTotal > 0) {
    const amount = platformsDashboard.receitaTotal / 100;
    const { error } = await historyRepo.create({
      country: "Brasil",
      currency: "BRL",
      market_label: "Platform Hub",
      period_start: monthStart,
      period_end: today,
      sales_amount: amount,
      sales_count: products.length,
      connector: "platform_hub",
      metadata: { source: "platform_hub_sync" },
    });
    if (!error) synced += 1;
  }

  for (const market of markets.filter((m) => m.status === "active")) {
    const sourceRef = `market:${market.id}`;
    const existing = await entriesRepo.findBySourceRef(sourceRef, "global");
    if (!existing.data) {
      const { error } = await entriesRepo.create({
        entry_type: "market",
        category: "winner",
        connector: "global",
        title: market.product_name ?? market.country,
        description: `Mercado ${market.country} — score ${market.global_score ?? "—"}`,
        country: market.country,
        currency: market.currency,
        performance_score: market.global_score,
        metrics: { global_score: market.global_score },
        source_ref: sourceRef,
      });
      if (!error) synced += 1;
    }

    const marketResults = results.filter((r) => r.market_id === market.id);
    for (const result of marketResults) {
      const { error } = await historyRepo.create({
        country: market.country,
        currency: result.currency,
        market_label: market.product_name ?? market.country,
        period_start: result.period_start,
        period_end: result.period_end,
        sales_amount: Number(result.revenue_amount),
        sales_count: 1,
        connector: "global",
        metadata: { result_id: result.id, source: result.source },
      });
      if (!error) synced += 1;
    }
  }

  const { entries, marketHistory } = await loadKnowledgeState();
  await rebuildPatternsFromData(entries, marketHistory, patternsRepo);

  return { synced, error: null };
}

export async function generateKnowledgeInsights(): Promise<{
  insights: KnowledgeInsight[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { insights: [], error: "Usuário não autenticado." };

  const state = await loadKnowledgeState();
  if (state.error) return { insights: [], error: state.error };

  const insightsRepo = new KnowledgeInsightsRepository(ctx.supabase, ctx.userId);
  const openai = getOpenAi();

  let generated: GeneratedKnowledgeInsights;

  if (openai) {
    const context = buildKnowledgeAuraContext(
      computeKnowledgeDashboard({
        entries: state.entries,
        insights: state.insights,
        patterns: state.patterns,
        marketHistory: state.marketHistory,
        connectedPlatforms: [],
      }),
      state.entries,
      state.patterns
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${KNOWLEDGE_AI_CONTEXT}
Retorne JSON:
{
  "insights": [{ "insight_type": "opportunity"|"risk"|"trend"|"emerging_market", "title": string, "summary": string, "priority": "low"|"medium"|"high" }],
  "resumo": string
}`,
        },
        { role: "user", content: context },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    generated =
      parseJsonBlock<GeneratedKnowledgeInsights>(
        response.choices[0]?.message?.content ?? ""
      ) ?? buildFallbackInsights(state.entries, state.marketHistory);
  } else {
    generated = buildFallbackInsights(state.entries, state.marketHistory);
  }

  const created: KnowledgeInsight[] = [];

  for (const insight of generated.insights.slice(0, 8)) {
    const { data, error } = await insightsRepo.create({
      insight_type: insight.insight_type,
      title: insight.title,
      summary: insight.summary,
      priority: insight.priority,
      status: "active",
      related_entry_ids: [],
      metadata: { generated_at: new Date().toISOString() },
    });
    if (!error && data) created.push(data);
  }

  return { insights: created, error: null };
}

export async function deleteKnowledgeEntry(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new KnowledgeEntriesRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}

export async function dismissKnowledgeInsight(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new KnowledgeInsightsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.update(id, { status: "dismissed" });
  return { error };
}

export async function getKnowledgeIaReply(params: {
  message: string;
  actionId?: string;
}): Promise<{ text: string; error: string | null }> {
  const [{ dashboard, entries, patterns, insights, error }, brain] = await Promise.all([
    getKnowledgeDashboard(),
    buildAuraContext(),
  ]);
  if (error) return { text: "", error };

  const openai = getOpenAi();
  const context = [brain.memoryContext, buildKnowledgeAuraContext(dashboard, entries, patterns)]
    .filter(Boolean)
    .join("\n\n");

  if (!openai) {
    if (params.actionId === "best-market") {
      return { text: `**Melhor mercado:** ${dashboard.melhorMercado}`, error: null };
    }
    if (params.actionId === "best-campaign") {
      return { text: `**Melhor campanha:** ${dashboard.melhorCampanha}`, error: null };
    }
    if (params.actionId === "avoid-errors") {
      const failures = entries.filter((e) => e.category === "loser" || e.entry_type === "failure");
      return {
        text:
          failures.length > 0
            ? failures.slice(0, 3).map((e) => `• ${e.title}`).join("\n")
            : "Nenhum erro registrado ainda.",
        error: null,
      };
    }
    return { text: dashboard.aprendizadoMes, error: null };
  }

  const actionHint =
    params.actionId === "monthly-learning"
      ? "Resuma o que aprendemos este mês."
      : params.actionId === "best-market"
        ? "Qual foi nosso melhor mercado e por quê?"
        : params.actionId === "best-campaign"
          ? "Qual foi nossa melhor campanha?"
          : params.actionId === "avoid-errors"
            ? "Quais erros não devemos repetir?"
            : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `${KNOWLEDGE_AI_CONTEXT} ${actionHint}
Responda em markdown, português do Brasil.`,
      },
      {
        role: "user",
        content: `${context}\n\nInsights ativos: ${insights.filter((i) => i.status === "active").length}\n\nPergunta: ${params.message}`,
      },
    ],
    temperature: 0.7,
  });

  return {
    text: response.choices[0]?.message?.content ?? "Sem resposta.",
    error: null,
  };
}
