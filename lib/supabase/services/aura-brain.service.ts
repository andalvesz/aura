import { GoalsRepository } from "@/lib/supabase/repositories/goals.repository";
import { AuraCeoSessionsRepository } from "@/lib/supabase/repositories/ceo.repository";
import {
  MoneyMissionPlansRepository,
} from "@/lib/supabase/repositories/money.repository";
import {
  MoneyMissionTasksRepository,
} from "@/lib/supabase/repositories/money-tasks.repository";
import { ExecutionPlansRepository } from "@/lib/supabase/repositories/execution.repository";
import { ExecutionTasksRepository } from "@/lib/supabase/repositories/execution-tasks.repository";
import { PerformanceReportsRepository } from "@/lib/supabase/repositories/performance-reports.repository";
import { CreatorProductsRepository } from "@/lib/supabase/repositories/creator.repository";
import {
  GlobalMarketsRepository,
  GlobalResultsRepository,
  GlobalStrategiesRepository,
} from "@/lib/supabase/repositories/global-intelligence.repository";
import {
  KnowledgeEntriesRepository,
  KnowledgePatternsRepository,
} from "@/lib/supabase/repositories/knowledge.repository";
import { AiMemoriesRepository } from "@/lib/supabase/repositories/ai-memories.repository";
import { getAuraCentralFinanceContext } from "@/lib/supabase/services/central.service";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { getEnglishCoachMentorContext } from "@/lib/supabase/services/english-coach.service";
import { listUpcomingEventos } from "@/lib/supabase/services/eventos.service";
import { listGrowthMissions } from "@/lib/supabase/services/growth.service";
import { getHealthCoachMentorContext } from "@/lib/supabase/services/health-coach.service";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import { loadLaunchPlans } from "@/lib/supabase/services/launch.service";
import { getNexusAlveszMentorContext } from "@/lib/supabase/services/nexus.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import { getSocialIaMentorContext } from "@/lib/supabase/services/social-ia.service";
import { listTrips } from "@/lib/supabase/services/travel.service";
import { loadAdsCampaigns } from "@/lib/supabase/services/ads-manager.service";
import { AutopilotActionsRepository } from "@/lib/supabase/repositories/autopilot-actions.repository";
import { AutopilotMonitorsRepository } from "@/lib/supabase/repositories/autopilot-monitors.repository";
import { AutopilotSettingsRepository } from "@/lib/supabase/repositories/autopilot-settings.repository";
import { getResolvedUserBudget } from "@/lib/supabase/services/campaign-budget.service";
import { getResolvedUserLocale } from "@/lib/supabase/services/creator-locale.service";
import { getPlatformsContext } from "@/lib/supabase/services/platform-hub.service";
import { getKiwifyIntelligenceContext } from "@/lib/supabase/services/kiwify-intelligence.service";
import { getMetaIntelligenceContext } from "@/lib/supabase/services/meta-intelligence.service";
import { listAuraMemories } from "@/lib/supabase/services/ai-memories.service";
import type { CreatorProductBundle } from "@/utils/creator";
import { rankProductsForLaunch } from "@/utils/creator";
import {
  buildAuraBrainMarkdown,
  buildAuraBrainMemoryMarkdown,
  buildAuraBrainOpeningBriefing,
  DEFAULT_BRAIN_DAILY_TASKS,
  type AuraBrainOpeningBriefing,
  type AuraBrainSections,
} from "@/utils/aura-brain";
import {
  computeOpportunityRadarFromData,
  parseOpportunityRadar,
} from "@/utils/ceo";
import { isCtrLowForHours, parseCampaignMetrics } from "@/utils/autopilot";
import { buildGlobalAuraContext, computeGlobalDashboard } from "@/utils/global";
import {
  buildKnowledgeAuraContext,
  computeKnowledgeDashboard,
} from "@/utils/knowledge";
import { buildAutopilotAuraContext, computeAutopilotDashboard } from "@/utils/autopilot";
import { formatBRL } from "@/utils/format";
import { getTodayMissions } from "@/utils/money";
import { parsePerformanceExecutiveMemory } from "@/utils/performance";
import { todayIsoDate } from "@/utils/health";
import { AI_MEMORY_CATEGORY_LABELS, formatAuraMemoryDate } from "@/utils/aura-memory";
import { truncatePreview } from "@/utils/memory";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext, resolveUserDisplayName } from "./context";

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  result: AuraBrainResult;
};

const brainCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<AuraBrainResult>>();

export type AuraBrainModuleData = {
  legacy: string;
  finance: string;
  money: string;
  moneyTasks: string;
  metas: string;
  creator: CreatorProductBundle[];
  creatorSummary: string;
  research: Awaited<ReturnType<typeof loadResearchRecords>>["records"];
  researchSummary: string;
  copylab: string;
  launch: string;
  social: string;
  alvesz: string;
  health: string;
  english: string;
  trips: string;
  eventos: string;
  growthMissions: string;
  autopilot: string;
  platforms: string;
  global: string;
  knowledge: string;
};

export type AuraBrainResult = {
  sections: AuraBrainSections;
  context: string;
  memoryContext: string;
  moduleData: AuraBrainModuleData;
  error: string | null;
};

function formatGoalsLines(
  goals: { titulo: string; tipo: string; atual: number; meta: number }[]
): string {
  if (!goals.length) return "Nenhuma meta ativa.";
  return goals
    .slice(0, 8)
    .map((g) => `• ${g.titulo} (${g.tipo}): ${g.atual}/${g.meta}`)
    .join("\n");
}

function formatPersistentMemories(
  memories: { categoria: string; titulo: string; created_at: string; conteudo: string }[]
): string {
  if (!memories.length) return "Nenhuma memória persistente registrada.";
  return memories
    .slice(0, 8)
    .map(
      (m) =>
        `• [${AI_MEMORY_CATEGORY_LABELS[m.categoria as keyof typeof AI_MEMORY_CATEGORY_LABELS] ?? m.categoria}] ${m.titulo} (${formatAuraMemoryDate(m.created_at)}): ${truncatePreview(m.conteudo, 120)}`
    )
    .join("\n");
}

async function loadBrainData(userId: string) {
  const ctx = await getOptionalDataContext();
  if (!ctx || ctx.userId !== userId) {
    return { error: "Usuário não autenticado." as const, data: null };
  }

  try {
  const today = todayIsoDate();
  const { supabase } = ctx;

  const [
    legacy,
    finance,
    moneyPlanRes,
    goalsRes,
    creatorRes,
    research,
    copylab,
    launch,
    social,
    alvesz,
    health,
    english,
    trips,
    eventosRes,
    growthMissions,
    autopilotSettingsRes,
    autopilotMonitorsRes,
    autopilotActionsRes,
    adsForAutopilotRes,
    platforms,
    kiwifyIntelligence,
    metaIntelligence,
    operationCenter,
    marketHunter,
    globalMarketsRes,
    globalStrategiesRes,
    globalResultsRes,
    knowledgeEntriesRes,
    knowledgePatternsRes,
    ceoSessionRes,
    ceoSessionsRes,
    executionPlanRes,
    performanceReportRes,
    budgetRes,
    localeRes,
    memoriesRes,
  ] = await Promise.all([
    getLegacyContext(),
    getAuraCentralFinanceContext(),
    new MoneyMissionPlansRepository(supabase, userId).findActive(),
    new GoalsRepository(supabase, userId).findActive(today),
    new CreatorProductsRepository(supabase, userId).findAllWithRelations(),
    loadResearchRecords(),
    loadCopylabRecords(),
    loadLaunchPlans(),
    getSocialIaMentorContext(),
    getNexusAlveszMentorContext(),
    getHealthCoachMentorContext(),
    getEnglishCoachMentorContext(),
    listTrips(),
    listUpcomingEventos(5),
    listGrowthMissions(),
    new AutopilotSettingsRepository(supabase, userId).findForUser(),
    new AutopilotMonitorsRepository(supabase, userId).findAllOrdered(),
    new AutopilotActionsRepository(supabase, userId).findAllOrdered(),
    loadAdsCampaigns(),
    getPlatformsContext(),
    getKiwifyIntelligenceContext(),
    getMetaIntelligenceContext(),
    import("./operation-center.service").then((mod) => mod.getOperationCenterContext()),
    import("./market-hunter.service").then((mod) => mod.getMarketHunterContext()),
    new GlobalMarketsRepository(supabase, userId).findAllOrdered(),
    new GlobalStrategiesRepository(supabase, userId).findAllOrdered(),
    new GlobalResultsRepository(supabase, userId).findAllOrdered(),
    new KnowledgeEntriesRepository(supabase, userId).findAllOrdered(),
    new KnowledgePatternsRepository(supabase, userId).findAllOrdered(),
    new AuraCeoSessionsRepository(supabase, userId).findActive(),
    new AuraCeoSessionsRepository(supabase, userId).findAllOrdered(),
    new ExecutionPlansRepository(supabase, userId).findByDate(today),
    new PerformanceReportsRepository(supabase, userId).findLatestActive(),
    getResolvedUserBudget(),
    getResolvedUserLocale(),
    listAuraMemories({ limit: 12 }),
  ]);

  let moneyTasks: Awaited<ReturnType<MoneyMissionTasksRepository["findByPlanId"]>>["data"] = [];
  if (moneyPlanRes.data) {
    const tasksRes = await new MoneyMissionTasksRepository(supabase, userId).findByPlanId(
      moneyPlanRes.data.id
    );
    moneyTasks = tasksRes.data ?? [];
  }

  let executionTasks: Awaited<ReturnType<ExecutionTasksRepository["findByPlanId"]>>["data"] = [];
  if (executionPlanRes.data) {
    const tasksRes = await new ExecutionTasksRepository(supabase, userId).findByPlanId(
      executionPlanRes.data.id
    );
    executionTasks = tasksRes.data ?? [];
  }

  const globalMarkets = globalMarketsRes.data ?? [];
  const globalStrategies = globalStrategiesRes.data ?? [];
  const globalResults = globalResultsRes.data ?? [];

  const knowledgeEntries = knowledgeEntriesRes.data ?? [];
  const knowledgePatterns = knowledgePatternsRes.data ?? [];

  const bundles = creatorRes.data ?? [];
  const ceoSession = ceoSessionRes.data ?? ceoSessionsRes.data?.[0] ?? null;
  const executiveMemory = performanceReportRes.data?.executive_memory
    ? parsePerformanceExecutiveMemory(performanceReportRes.data.executive_memory)
    : null;

  const autopilotCampaigns = adsForAutopilotRes.records ?? [];
  const autopilotSettings = autopilotSettingsRes.data ?? null;
  const autopilotMonitors = autopilotMonitorsRes.data ?? [];
  const autopilotActions = autopilotActionsRes.data ?? [];

  const autopilotContext = buildAutopilotAuraContext({
    dashboard: computeAutopilotDashboard({
      campaigns: autopilotCampaigns,
      monitors: autopilotMonitors,
      actions: autopilotActions,
      settings: autopilotSettings,
    }),
    campaigns: autopilotCampaigns,
    monitors: autopilotMonitors,
    actions: autopilotActions,
    settings: autopilotSettings,
  });

  const globalDashboard = computeGlobalDashboard({
    markets: globalMarkets,
    strategies: globalStrategies,
    results: globalResults,
  });
  const globalContext = buildGlobalAuraContext(globalDashboard, globalMarkets, globalStrategies);

  const knowledgeDashboard = computeKnowledgeDashboard({
    entries: knowledgeEntries,
    insights: [],
    patterns: knowledgePatterns,
    marketHistory: [],
    connectedPlatforms: [],
  });
  const knowledgeContext = buildKnowledgeAuraContext(
    knowledgeDashboard,
    knowledgeEntries,
    knowledgePatterns
  );

  const goals = goalsRes.data ?? [];
  const ranked = rankProductsForLaunch(bundles);
  const topProduct = ranked[0];

  const winners = knowledgeEntries.filter(
    (e) => e.category === "winner" && e.status === "active"
  );
  const failures = knowledgeEntries.filter(
    (e) => e.category === "loser" || e.entry_type === "failure"
  );
  const workedPatterns = knowledgePatterns.filter((p) => p.pattern_type === "what_worked");
  const failedPatterns = knowledgePatterns.filter((p) => p.pattern_type === "what_failed");
  const campaignWinners = winners.filter((e) => e.entry_type === "campaign");

  const legadoSection = [
    legacy.context ?? "Nenhum dado de legado.",
    goals.length > 0 ? `\n**Objetivos ativos:**\n${formatGoalsLines(goals)}` : "",
    Array.isArray(ceoSession?.prioridades) && ceoSession.prioridades.length > 0
      ? `\n**Valores estratégicos (CEO):** ${(ceoSession.prioridades as string[]).slice(0, 5).join("; ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const negociosSection = [
    alvesz.context ? `**Alvesz Experience:**\n${alvesz.context.slice(0, 500)}` : "",
    bundles.length > 0
      ? `**Produtos Creator:**\n${bundles
          .slice(0, 5)
          .map((b) => `• ${b.product.nome} (${b.product.status})`)
          .join("\n")}`
      : "Nenhum produto Creator.",
    adsForAutopilotRes.records.length > 0
      ? `**Campanhas:**\n${adsForAutopilotRes.records
          .slice(0, 5)
          .map((c) => `• ${c.nome ?? "Campanha"} — ${c.status ?? "—"}`)
          .join("\n")}`
      : "",
    platforms.context || kiwifyIntelligence.context || metaIntelligence.context || operationCenter.context
      ? `**Plataformas:**\n${[platforms.context, kiwifyIntelligence.context, metaIntelligence.context, operationCenter.context].filter(Boolean).join("\n").slice(0, 1200)}`
      : "",
    copylab.records.length > 0
      ? `**CopyLab:**\n${copylab.records
          .slice(0, 3)
          .map((c) => `• ${c.nome ?? c.headline ?? "Copy"}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const moneyPlan = moneyPlanRes.data;
  const financeiroSection = [
    finance.context ? finance.context.slice(0, 600) : "",
    budgetRes.budget.orcamento != null
      ? `**Orçamento disponível:** ${formatBRL(budgetRes.budget.orcamento)}`
      : "**Orçamento disponível:** não informado",
    moneyPlan
      ? `**Money Missions:** Meta ${formatBRL(Number(moneyPlan.valor_meta))} · Conquistado ${formatBRL(Number(moneyPlan.valor_conquistado))} · Prob. ${moneyPlan.probabilidade_sucesso ?? "—"}%`
      : "Nenhum plano Money Missions ativo.",
    formatGoalsLines(goals.filter((g) => g.tipo === "vendas" || g.tipo === "financeira")),
  ]
    .filter(Boolean)
    .join("\n\n");

  const globalSection = [
    globalContext,
    marketHunter.context ? marketHunter.context : "",
    localeRes.locale
      ? `**Locale ativo:** ${localeRes.locale.target_country} · ${localeRes.locale.target_language} · ${localeRes.locale.currency}`
      : "",
    globalMarkets.length > 0
      ? `**Mercados analisados:**\n${globalMarkets
          .slice(0, 5)
          .map((m) => `• ${m.country} — score ${m.global_score ?? "—"}/100`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const pendingTasks = (executionTasks ?? []).filter((t) => t.status === "pending");
  const execucaoSection = [
    operationCenter.context ? operationCenter.context : "",
    ceoSession
      ? `**CEO:** ${ceoSession.resumo_executivo?.slice(0, 200) ?? "—"}\nPrioridades: ${JSON.stringify(ceoSession.prioridades)?.slice(0, 200) ?? "—"}`
      : "Nenhuma sessão CEO ativa.",
    executionPlanRes.data
      ? `**Plano do dia:** ${executionPlanRes.data.titulo} · ${pendingTasks.length} tarefas pendentes`
      : "Nenhum plano de execução hoje.",
    pendingTasks.length > 0
      ? `**Tarefas:**\n${pendingTasks
          .slice(0, 6)
          .map((t) => `• [P${t.prioridade}] ${t.titulo} (${t.modulo_origem})`)
          .join("\n")}`
      : "",
    topProduct
      ? `**Projeto prioritário:** ${topProduct.product.nome} (${topProduct.product.status})`
      : "",
    growthMissions.data
      ?.filter((m) => m.status === "pending" && m.mission_date === today)
      .slice(0, 3)
      .map((m) => `• Missão: ${m.titulo}`)
      .join("\n") ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const memoriaSection = [
    workedPatterns.length > 0
      ? `**Estratégias vencedoras:**\n${workedPatterns
          .slice(0, 5)
          .map((p) => `• ${p.label} (confiança ${p.confidence_score}%)`)
          .join("\n")}`
      : "",
    campaignWinners.length > 0
      ? `**Campanhas vencedoras:**\n${campaignWinners
          .slice(0, 5)
          .map((e) => `• ${e.title} (score ${e.performance_score ?? "—"})`)
          .join("\n")}`
      : "",
    (failures.length > 0 || failedPatterns.length > 0)
      ? `**Erros recorrentes:**\n${[
          ...failedPatterns.slice(0, 3).map((p) => `• ${p.label}`),
          ...failures.slice(0, 3).map((e) => `• ${e.title}`),
        ].join("\n")}`
      : "",
    knowledgeDashboard.aprendizadoMes
      ? `**Aprendizado:** ${knowledgeDashboard.aprendizadoMes}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const sections: AuraBrainSections = {
    legado: legadoSection,
    negocios: negociosSection,
    financeiro: financeiroSection,
    global: globalSection,
    execucao: execucaoSection,
    memoria: memoriaSection,
  };

  const moduleData: AuraBrainModuleData = {
    legacy: legacy.context ?? "",
    finance: finance.context ?? "",
    money: moneyPlan
      ? `Meta: ${formatBRL(Number(moneyPlan.valor_meta))} · Progresso: ${formatBRL(Number(moneyPlan.valor_conquistado))}`
      : "Nenhum plano Money Missions ativo.",
    moneyTasks: getTodayMissions(moneyTasks ?? [])
      .map((t) => t.titulo)
      .join(", "),
    metas: formatGoalsLines(goals),
    creator: bundles,
    creatorSummary:
      bundles
        .slice(0, 5)
        .map((b) => `• ${b.product.nome} (${b.product.status})`)
        .join("\n") || "Nenhum produto Creator.",
    research: research.records,
    researchSummary:
      research.records
        .slice(0, 3)
        .map((r) => `• ${r.nicho ?? r.ideia_input}: nota ${r.nota_final ?? "—"}`)
        .join("\n") || "Nenhuma pesquisa.",
    copylab:
      copylab.records
        .slice(0, 3)
        .map((c) => `• ${c.nome ?? c.headline ?? "Copy"}`)
        .join("\n") || "Nenhum copy.",
    launch:
      launch.plans
        .slice(0, 3)
        .map((p) => `• ${p.titulo ?? "Plano"}`)
        .join("\n") || "Nenhum plano de lançamento.",
    social: social.context ?? "",
    alvesz: alvesz.context ?? "",
    health: health.context ?? "",
    english: english.context ?? "",
    trips:
      trips.trips
        .slice(0, 3)
        .map((t) => `• ${t.destino ?? t.nome} (${t.data_ida ?? "—"})`)
        .join("\n") || "Nenhuma viagem.",
    eventos:
      eventosRes.data
        ?.slice(0, 5)
        .map((e) => `• ${e.titulo} — ${e.data_inicio}`)
        .join("\n") || "Nenhum evento próximo.",
    growthMissions:
      growthMissions.data
        ?.filter((m) => m.status === "pending" && m.mission_date === today)
        .slice(0, 3)
        .map((m) => m.titulo)
        .join(", ") || "",
    autopilot: autopilotContext,
    platforms: [platforms.context, kiwifyIntelligence.context, metaIntelligence.context, operationCenter.context].filter(Boolean).join("\n\n"),
    global: globalContext,
    knowledge: knowledgeContext,
  };

  const memoryContext = buildAuraBrainMemoryMarkdown({
    estrategiasVencedoras: workedPatterns
      .slice(0, 5)
      .map((p) => `• ${p.label}`)
      .join("\n"),
    campanhasVencedoras: campaignWinners
      .slice(0, 5)
      .map((e) => `• ${e.title}`)
      .join("\n"),
    errosRecorrentes: [
      ...failedPatterns.slice(0, 3).map((p) => `• ${p.label}`),
      ...failures.slice(0, 3).map((e) => `• ${e.title}`),
    ].join("\n"),
    aprendizadoMes: knowledgeDashboard.aprendizadoMes,
    memoriaPersistente: formatPersistentMemories(memoriesRes.memories),
    executiveMemory,
  });

  return {
    error: null,
    data: {
      sections,
      context: buildAuraBrainMarkdown(sections),
      memoryContext,
      moduleData,
    },
  };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingSupabaseTableError(message)) {
      return { error: null, data: null };
    }
    console.warn("[aura-brain] loadBrainData:", message);
    return { error: message, data: null };
  }
}

export function invalidateAuraBrainCache(userId?: string): void {
  if (userId) {
    brainCache.delete(userId);
    inflight.delete(userId);
    return;
  }
  brainCache.clear();
  inflight.clear();
}

export async function buildAuraContext(): Promise<AuraBrainResult> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      sections: {
        legado: "",
        negocios: "",
        financeiro: "",
        global: "",
        execucao: "",
        memoria: "",
      },
      context: "",
      memoryContext: "",
      moduleData: {
        legacy: "",
        finance: "",
        money: "",
        moneyTasks: "",
        metas: "",
        creator: [],
        creatorSummary: "",
        research: [],
        researchSummary: "",
        copylab: "",
        launch: "",
        social: "",
        alvesz: "",
        health: "",
        english: "",
        trips: "",
        eventos: "",
        growthMissions: "",
        autopilot: "",
        platforms: "",
        global: "",
        knowledge: "",
      },
      error: "Usuário não autenticado.",
    };
  }

  const { userId } = ctx;
  const now = Date.now();
  const cached = brainCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }

  const pending = inflight.get(userId);
  if (pending) return pending;

  const promise = (async () => {
    try {
    const loaded = await loadBrainData(userId);
    if (loaded.error || !loaded.data) {
      const result: AuraBrainResult = {
        sections: {
          legado: "",
          negocios: "",
          financeiro: "",
          global: "",
          execucao: "",
          memoria: "",
        },
        context: "",
        memoryContext: "",
        moduleData: {
          legacy: "",
          finance: "",
          money: "",
          moneyTasks: "",
          metas: "",
          creator: [],
          creatorSummary: "",
          research: [],
          researchSummary: "",
          copylab: "",
          launch: "",
          social: "",
          alvesz: "",
          health: "",
          english: "",
          trips: "",
          eventos: "",
          growthMissions: "",
          autopilot: "",
          platforms: "",
          global: "",
          knowledge: "",
        },
        error: loaded.error,
      };
      return result;
    }

    const result: AuraBrainResult = {
      ...loaded.data,
      error: null,
    };

    brainCache.set(userId, { expiresAt: now + CACHE_TTL_MS, result });
    return result;
    } finally {
      inflight.delete(userId);
    }
  })();

  inflight.set(userId, promise);
  return promise;
}

function resolveMetaPrincipal(brain: AuraBrainResult): string {
  const legacyBlob = `${brain.sections.legado} ${brain.moduleData.trips}`.toLowerCase();
  if (legacyBlob.includes("disney") || legacyBlob.includes("nba")) {
    return "Financiar Disney + NBA";
  }

  if (brain.moduleData.money && !brain.moduleData.money.includes("Nenhum")) {
    const metaPart = brain.moduleData.money.split(" · ")[0]?.replace("Meta: ", "").trim();
    if (metaPart) return metaPart;
  }

  const firstMeta = brain.moduleData.metas
    .split("\n")
    .find((line) => line.startsWith("•"));
  if (firstMeta && !firstMeta.includes("Nenhuma")) {
    return firstMeta.replace("• ", "").split(" (")[0] ?? firstMeta;
  }

  return "Defina sua meta principal em Metas ou Money Missions";
}

function resolveDailyTasks(brain: AuraBrainResult, executionTasks: string[]): string[] {
  if (executionTasks.length > 0) return executionTasks;

  const moneyTasks = brain.moduleData.moneyTasks
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (moneyTasks.length > 0) return moneyTasks.slice(0, 4);

  const growth = brain.moduleData.growthMissions
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (growth.length > 0) return growth.slice(0, 4);

  return [...DEFAULT_BRAIN_DAILY_TASKS];
}

function resolveMelhorOportunidade(
  brain: AuraBrainResult,
  ceoSession: Awaited<ReturnType<AuraCeoSessionsRepository["findActive"]>>["data"]
): string {
  if (ceoSession?.opportunity_radar) {
    const radar = parseOpportunityRadar(ceoSession.opportunity_radar);
    const item = radar?.melhorOportunidade;
    if (item?.titulo && item.titulo !== "—") {
      if (
        item.moeda_recomendada === "USD" ||
        item.titulo.toLowerCase().includes("dólar") ||
        item.titulo.toLowerCase().includes("dolar") ||
        item.descricao?.toLowerCase().includes("internacional")
      ) {
        return "Produto internacional em dólar.";
      }
      return item.titulo;
    }
  }

  const computed = computeOpportunityRadarFromData({
    bundles: brain.moduleData.creator,
    research: brain.moduleData.research,
    legacySummary: brain.moduleData.legacy.slice(0, 200),
  });

  if (computed.melhorOportunidade.titulo !== "—") {
    return computed.melhorOportunidade.titulo;
  }

  if (brain.sections.global.toLowerCase().includes("usd") || brain.sections.global.includes("Estados Unidos")) {
    return "Produto internacional em dólar.";
  }

  return "Validar produto no Creator e pesquisar mercado";
}

function resolveRiscoAtual(
  monitors: Awaited<ReturnType<AutopilotMonitorsRepository["findAllOrdered"]>>["data"],
  campaigns: Awaited<ReturnType<typeof loadAdsCampaigns>>["records"]
): string {
  for (const monitor of monitors ?? []) {
    const metrics = parseCampaignMetrics(monitor.metrics);
    if (!metrics) continue;

    const campaign = campaigns.find((c) => c.id === monitor.campaign_id);
    const name = campaign?.nome ?? "Campanha";

    if (metrics.ctr < 1 || isCtrLowForHours(metrics, 1, 0)) {
      return `${name} com CTR baixo.`;
    }
  }

  return "Nenhum risco crítico detectado — monitore campanhas no Autopilot.";
}

function resolveSugestao(
  actions: Awaited<ReturnType<AutopilotActionsRepository["findAllOrdered"]>>["data"]
): string {
  const pending = (actions ?? []).find(
    (a) => a.status === "suggested" || a.status === "pending_approval"
  );

  if (pending?.suggestion?.trim()) return pending.suggestion.trim();
  if (pending?.action_type === "generate_creative") return "Gerar novo criativo.";
  if (pending?.action_type === "generate_copy") return "Gerar nova copy no CopyLab.";

  return "Gerar novo criativo.";
}

export async function getAuraBrainOpeningSummary(): Promise<{
  summary: AuraBrainOpeningBriefing | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { summary: null, error: "Usuário não autenticado." };
  }

  try {
    const displayName = await resolveUserDisplayName(ctx);
    const brain = await buildAuraContext();
    if (brain.error === "Usuário não autenticado.") {
      return { summary: null, error: brain.error };
    }

    const today = todayIsoDate();
    const { supabase, userId } = ctx;

    const [ceoSessionRes, executionPlanRes, monitorsRes, adsRes, actionsRes] =
      await Promise.all([
        new AuraCeoSessionsRepository(supabase, userId).findActive(),
        new ExecutionPlansRepository(supabase, userId).findByDate(today),
        new AutopilotMonitorsRepository(supabase, userId).findAllOrdered(),
        loadAdsCampaigns(),
        new AutopilotActionsRepository(supabase, userId).findAllOrdered(),
      ]);

    let executionTaskTitles: string[] = [];
    if (executionPlanRes.data) {
      const tasksRes = await new ExecutionTasksRepository(supabase, userId).findByPlanId(
        executionPlanRes.data.id
      );
      executionTaskTitles = (tasksRes.data ?? [])
        .filter((t) => t.status === "pending")
        .sort((a, b) => a.ordem - b.ordem)
        .slice(0, 4)
        .map((t) => t.titulo);
    }

    const summary = buildAuraBrainOpeningBriefing({
      displayName,
      metaPrincipal: resolveMetaPrincipal(brain),
      tarefasHoje: resolveDailyTasks(brain, executionTaskTitles),
      melhorOportunidade: resolveMelhorOportunidade(brain, ceoSessionRes.data),
      riscoAtual: resolveRiscoAtual(monitorsRes.data, adsRes.records),
      sugestao: resolveSugestao(actionsRes.data),
    });

    return { summary, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingSupabaseTableError(message)) {
      return { summary: null, error: null };
    }
    console.warn("[aura-brain] getAuraBrainOpeningSummary:", message);
    return { summary: null, error: message };
  }
}
