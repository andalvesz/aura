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
import { listAuraMemories } from "@/lib/supabase/services/ai-memories.service";
import type { CreatorProductBundle } from "@/utils/creator";
import { rankProductsForLaunch } from "@/utils/creator";
import {
  buildAuraBrainMarkdown,
  buildAuraBrainMemoryMarkdown,
  type AuraBrainSections,
} from "@/utils/aura-brain";
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
import { getOptionalDataContext } from "./context";

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
    platforms.context ? `**Plataformas:**\n${platforms.context.slice(0, 400)}` : "",
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
    platforms: platforms.context ?? "",
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
    inflight.delete(userId);
    return result;
  })();

  inflight.set(userId, promise);
  return promise;
}
