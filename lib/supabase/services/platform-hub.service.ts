import OpenAI from "openai";
import {
  decryptCredentials,
  encryptCredentials,
  maskCredential,
} from "@/lib/crypto/credentials";
import {
  isPlatformAvailable,
  syncPlatform,
  testPlatformConnection,
} from "@/lib/platforms/registry";
import type { PlatformAuthType, PlatformId } from "@/lib/platforms/types";
import {
  AffiliateAnalysisRepository,
  AffiliateProductsRepository,
  PlatformConnectionsRepository,
  PlatformSyncLogsRepository,
} from "@/lib/supabase/repositories/platform-hub.repository";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import type {
  AffiliateAnalysis,
  AffiliateProduct,
  PlatformConnection,
  PlatformSyncLog,
  TableInsert,
} from "@/types/database";
import {
  buildPlatformsAuraContext,
  computePlatformsDashboard,
  parseAffiliateInsights,
  type AffiliateScoreInsight,
  type PlatformConnectionPublic,
  type PlatformsDashboardMetrics,
} from "@/utils/platforms";
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

function toPublicConnection(row: PlatformConnection): PlatformConnectionPublic {
  let credentialHint: string | undefined;
  try {
    const creds = decryptCredentials(row.credentials_encrypted);
    const firstKey = Object.keys(creds)[0];
    if (firstKey) credentialHint = maskCredential(creds[firstKey]);
  } catch {
    credentialHint = "••••••••";
  }

  return {
    id: row.id,
    user_id: row.user_id,
    platform: row.platform,
    auth_type: row.auth_type,
    status: row.status,
    account_label: row.account_label,
    external_account_id: row.external_account_id,
    metadata: row.metadata,
    last_sync_at: row.last_sync_at,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
    credentialHint,
  };
}

async function loadPlatformState() {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      connections: [] as PlatformConnectionPublic[],
      products: [] as AffiliateProduct[],
      syncLogs: [] as PlatformSyncLog[],
      analyses: [] as AffiliateAnalysis[],
      error: "Usuário não autenticado.",
    };
  }

  const connRepo = new PlatformConnectionsRepository(ctx.supabase, ctx.userId);
  const productsRepo = new AffiliateProductsRepository(ctx.supabase, ctx.userId);
  const logsRepo = new PlatformSyncLogsRepository(ctx.supabase, ctx.userId);
  const analysisRepo = new AffiliateAnalysisRepository(ctx.supabase, ctx.userId);

  const [
    { data: connections, error: connError },
    { data: products, error: productsError },
    { data: syncLogs, error: logsError },
    { data: analyses, error: analysesError },
  ] = await Promise.all([
    connRepo.findAllOrdered(),
    productsRepo.findAllOrdered(),
    logsRepo.findRecent(30),
    analysisRepo.findAllOrdered(),
  ]);

  const error = connError ?? productsError ?? logsError ?? analysesError;
  if (error) {
    return {
      connections: [],
      products: [],
      syncLogs: [],
      analyses: [],
      error,
    };
  }

  return {
    connections: (connections ?? []).map(toPublicConnection),
    products: products ?? [],
    syncLogs: syncLogs ?? [],
    analyses: analyses ?? [],
    error: null,
  };
}

export async function getPlatformsDashboard(): Promise<{
  dashboard: PlatformsDashboardMetrics;
  connections: PlatformConnectionPublic[];
  products: AffiliateProduct[];
  syncLogs: PlatformSyncLog[];
  analyses: AffiliateAnalysis[];
  error: string | null;
}> {
  const state = await loadPlatformState();
  if (state.error) {
    return {
      dashboard: computePlatformsDashboard({
        connections: [],
        products: [],
        syncLogs: [],
        analyses: [],
      }),
      connections: [],
      products: [],
      syncLogs: [],
      analyses: [],
      error: state.error,
    };
  }

  return {
    dashboard: computePlatformsDashboard(state),
    connections: state.connections,
    products: state.products,
    syncLogs: state.syncLogs,
    analyses: state.analyses,
    error: null,
  };
}

export async function connectPlatform(params: {
  platform: PlatformId;
  authType: PlatformAuthType;
  credentials: Record<string, string>;
  accountLabel?: string;
}): Promise<{ connection: PlatformConnectionPublic | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { connection: null, error: "Usuário não autenticado." };

  if (!isPlatformAvailable(params.platform)) {
    return { connection: null, error: "Plataforma ainda não disponível nesta versão." };
  }

  const cleaned = Object.fromEntries(
    Object.entries(params.credentials)
      .map(([k, v]) => [k, v.trim()])
      .filter(([, v]) => v.length > 0)
  );

  if (Object.keys(cleaned).length === 0) {
    return { connection: null, error: "Informe as credenciais da plataforma." };
  }

  const test = await testPlatformConnection(params.platform, cleaned);
  if (!test.ok) {
    return { connection: null, error: test.error ?? "Falha ao validar conexão." };
  }

  const repo = new PlatformConnectionsRepository(ctx.supabase, ctx.userId);
  const existing = await repo.findByPlatform(params.platform);

  const encrypted = encryptCredentials(cleaned);
  const payload: Omit<TableInsert<"platform_connections">, "user_id"> = {
    platform: params.platform,
    auth_type: params.authType,
    status: "connected",
    account_label: params.accountLabel ?? test.label ?? params.platform,
    external_account_id: cleaned.account_id ?? null,
    credentials_encrypted: encrypted,
    metadata: {},
    last_error: null,
  };

  if (existing.data) {
    const { data, error } = await repo.update(existing.data.id, payload);
    if (error || !data) return { connection: null, error: error ?? "Erro ao atualizar conexão." };
    return { connection: toPublicConnection(data), error: null };
  }

  const { data, error } = await repo.create(payload);
  if (error || !data) return { connection: null, error: error ?? "Erro ao salvar conexão." };
  return { connection: toPublicConnection(data), error: null };
}

export async function disconnectPlatform(
  platform: PlatformId
): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new PlatformConnectionsRepository(ctx.supabase, ctx.userId);
  const existing = await repo.findByPlatform(platform);
  if (!existing.data) return { error: "Conexão não encontrada." };

  const { error } = await repo.update(existing.data.id, {
    status: "disconnected",
    last_error: null,
  });
  return { error };
}

export async function deletePlatformConnection(
  connectionId: string
): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new PlatformConnectionsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(connectionId);
  return { error };
}

async function syncSingleConnection(connection: PlatformConnection): Promise<{
  log: PlatformSyncLog | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { log: null, error: "Usuário não autenticado." };

  const connRepo = new PlatformConnectionsRepository(ctx.supabase, ctx.userId);
  const logsRepo = new PlatformSyncLogsRepository(ctx.supabase, ctx.userId);
  const productsRepo = new AffiliateProductsRepository(ctx.supabase, ctx.userId);

  const { data: runningLog, error: logCreateError } = await logsRepo.create({
    connection_id: connection.id,
    platform: connection.platform,
    sync_type: "full",
    status: "running",
    records_synced: 0,
    payload_summary: {},
  });

  if (logCreateError || !runningLog) {
    return { log: null, error: logCreateError ?? "Erro ao iniciar sync." };
  }

  try {
    const credentials = decryptCredentials(connection.credentials_encrypted);
    const result = await syncPlatform(connection.platform as PlatformId, credentials);

    const now = new Date().toISOString();
    const affiliateRows = result.affiliateProducts.map((p) => ({
      connection_id: connection.id,
      platform: connection.platform,
      external_product_id: p.externalId,
      name: p.name,
      price_cents: p.priceCents,
      commission_cents: p.commissionCents,
      commission_pct: p.commissionPct,
      currency: p.currency,
      status: p.status,
      affiliate_enabled: p.affiliateEnabled,
      metadata: (p.metadata ?? {}) as TableInsert<"affiliate_products">["metadata"],
      last_synced_at: now,
    }));

    const summary = {
      productsCount: result.products.length,
      salesCount: result.sales.length,
      affiliateProductsCount: result.affiliateProducts.length,
      revenueTotalCents: result.revenueTotalCents,
      commissionsTotalCents: result.commissionsTotalCents,
    };

    await connRepo.update(connection.id, {
      status: "connected",
      last_sync_at: now,
      last_error: null,
      account_label: result.accountLabel ?? connection.account_label,
      metadata: {
        ...(connection.metadata as Record<string, unknown>),
        lastSyncSummary: summary,
      },
    });

    const { data: log } = await logsRepo.update(runningLog.id, {
      status: "success",
      records_synced:
        result.products.length + result.sales.length + result.affiliateProducts.length,
      payload_summary: summary,
    });

    return { log, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na sincronização.";
    await connRepo.update(connection.id, {
      status: "error",
      last_error: message,
    });
    await logsRepo.update(runningLog.id, {
      status: "error",
      error_message: message,
    });
    return { log: null, error: message };
  }
}

export async function syncPlatformConnection(
  platform?: PlatformId
): Promise<{ logs: PlatformSyncLog[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { logs: [], error: "Usuário não autenticado." };

  const connRepo = new PlatformConnectionsRepository(ctx.supabase, ctx.userId);
  const { data: connections, error } = await connRepo.findAllOrdered();
  if (error) return { logs: [], error };

  const targets = (connections ?? []).filter((c) => {
    if (c.status === "disconnected") return false;
    if (platform) return c.platform === platform;
    return true;
  });

  if (targets.length === 0) {
    return { logs: [], error: "Nenhuma plataforma conectada para sincronizar." };
  }

  const logs: PlatformSyncLog[] = [];
  let lastError: string | null = null;

  for (const connection of targets) {
    const { log, error: syncError } = await syncSingleConnection(connection);
    if (log) logs.push(log);
    if (syncError) lastError = syncError;
  }

  return { logs, error: lastError };
}

type GeneratedAffiliateAnalysis = {
  insights: AffiliateScoreInsight[];
  resumo: string;
};

const AFFILIATE_ANALYSIS_PROMPT = `Você é a Aura Platform Hub — analise produtos de afiliação.
Responda APENAS JSON:
{
  "resumo": string,
  "insights": [
    {
      "produto": string,
      "plataforma": string,
      "aiScore": number,
      "ticketMedio": number,
      "potencial": string,
      "concorrencia": string,
      "legadoCompat": string,
      "recomendacao": string
    }
  ]
}
Regras:
- aiScore: 0-100 (melhor produto para afiliação)
- ticketMedio em reais (número)
- Analise potencial de venda, concorrência e compatibilidade com legado do usuário
- insights: 3-8 produtos ranqueados
- Português do Brasil`;

async function callAffiliateAi(
  products: AffiliateProduct[],
  legacyContext: string
): Promise<GeneratedAffiliateAnalysis | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const input = products.slice(0, 30).map((p) => ({
    produto: p.name,
    plataforma: p.platform,
    preco: p.price_cents != null ? p.price_cents / 100 : null,
    comissao: p.commission_cents != null ? p.commission_cents / 100 : null,
    comissao_pct: p.commission_pct,
    afiliacao: p.affiliate_enabled,
  }));

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: AFFILIATE_ANALYSIS_PROMPT },
      {
        role: "user",
        content: JSON.stringify({ produtos: input, legado: legacyContext }),
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.6,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<GeneratedAffiliateAnalysis>(content);
}

function buildFallbackAnalysis(products: AffiliateProduct[]): GeneratedAffiliateAnalysis {
  const insights: AffiliateScoreInsight[] = products.slice(0, 5).map((p, idx) => {
    const ticket = p.price_cents != null ? p.price_cents / 100 : 97;
    const commission = p.commission_cents != null ? p.commission_cents / 100 : ticket * 0.3;
    const score = Math.min(95, 60 + idx * 5 + (p.affiliate_enabled ? 10 : 0));
    return {
      produto: p.name,
      plataforma: p.platform,
      aiScore: score,
      ticketMedio: ticket,
      potencial: commission > 50 ? "Alto" : "Médio",
      concorrencia: idx < 2 ? "Moderada" : "Alta",
      legadoCompat: "Compatível com nichos digitais do perfil",
      recomendacao: `Promover via Creator + tráfego pago com ticket de R$ ${ticket.toFixed(0)}`,
    };
  });

  return {
    resumo: "Análise heurística baseada em comissões e preços sincronizados.",
    insights,
  };
}

export async function runAffiliateAnalysis(): Promise<{
  analyses: AffiliateAnalysis[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { analyses: [], error: "Usuário não autenticado." };

  const { products, error: loadError } = await loadPlatformState();
  if (loadError) return { analyses: [], error: loadError };

  if (products.length === 0) {
    return {
      analyses: [],
      error: "Sincronize produtos de uma plataforma antes de gerar o Score IA.",
    };
  }

  const { context: legacyContext } = await getLegacyContext();
  const generated =
    (await callAffiliateAi(products, legacyContext ?? "")) ?? buildFallbackAnalysis(products);

  const analysisRepo = new AffiliateAnalysisRepository(ctx.supabase, ctx.userId);
  const productsRepo = new AffiliateProductsRepository(ctx.supabase, ctx.userId);
  const { data: allProducts } = await productsRepo.findAllOrdered();

  const created: AffiliateAnalysis[] = [];

  for (const insight of generated.insights) {
    const product = (allProducts ?? []).find(
      (p) => p.name === insight.produto && p.platform === insight.plataforma
    );

    const row: Omit<TableInsert<"affiliate_analysis">, "user_id"> = {
      platform: insight.plataforma,
      affiliate_product_id: product?.id ?? null,
      analysis_type: "affiliate_score",
      ai_score: Math.round(insight.aiScore),
      ticket_medio: insight.ticketMedio,
      potencial_venda: null,
      concorrencia: insight.concorrencia,
      legado_compat: insight.legadoCompat,
      summary: `${insight.produto} | ${insight.recomendacao}`,
      insights: [insight] as TableInsert<"affiliate_analysis">["insights"],
      raw_input: { potencial: insight.potencial },
    };

    const { data, error } = await analysisRepo.create(row);
    if (data) created.push(data);
    if (error) return { analyses: created, error };
  }

  if (created.length === 0) {
    const { data, error } = await analysisRepo.create({
      platform: null,
      affiliate_product_id: null,
      analysis_type: "product_ranking",
      ai_score: null,
      summary: generated.resumo,
      insights: generated.insights as TableInsert<"affiliate_analysis">["insights"],
      raw_input: {},
    });
    if (data) created.push(data);
    if (error) return { analyses: [], error };
  }

  return { analyses: created, error: null };
}

export async function getPlatformsContext(): Promise<{ context: string; error: string | null }> {
  const state = await loadPlatformState();
  if (state.error) return { context: "", error: state.error };

  const dashboard = computePlatformsDashboard(state);
  return {
    context: buildPlatformsAuraContext(dashboard, state.products, state.connections),
    error: null,
  };
}

export async function getPlatformsIaReply(params: {
  message: string;
  actionId?: string;
}): Promise<{ text: string; error: string | null }> {
  const { dashboard, products, connections, analyses, error } = await getPlatformsDashboard();
  if (error) return { text: "", error };

  const openai = getOpenAi();
  const context = buildPlatformsAuraContext(dashboard, products, connections);

  const topInsights = analyses
    .filter((a) => a.ai_score != null)
    .slice(0, 5)
    .map((a) => ({
      score: a.ai_score,
      summary: a.summary,
      legado: a.legado_compat,
    }));

  if (!openai) {
    const best = analyses.sort((a, b) => (b.ai_score ?? 0) - (a.ai_score ?? 0))[0];
    if (params.actionId === "import-results") {
      return {
        text: "Conecte suas plataformas e clique em **Sincronizar tudo** para importar resultados.",
        error: null,
      };
    }
    return {
      text: best
        ? `Score IA: **${best.summary}** (${best.ai_score}/100)`
        : "Sincronize produtos e gere o Score IA para recomendações.",
      error: null,
    };
  }

  const actionHint =
    params.actionId === "best-affiliate"
      ? "Liste os melhores produtos para afiliação com Score IA."
      : params.actionId === "promote-product"
        ? "Recomende qual produto promover agora e por quê."
        : params.actionId === "import-results"
          ? "Explique como importar e sincronizar resultados das plataformas."
          : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `Você é a Aura Platform Hub. ${actionHint}
Use os dados sincronizados. Integre com Performance AI, Money Missions, CEO e Execution quando relevante.
Responda em markdown, português do Brasil.`,
      },
      {
        role: "user",
        content: `${context}\n\nInsights:\n${JSON.stringify(topInsights)}\n\nPergunta: ${params.message}`,
      },
    ],
    temperature: 0.7,
  });

  return {
    text: response.choices[0]?.message?.content ?? "Sem resposta.",
    error: null,
  };
}

export { parseAffiliateInsights };
