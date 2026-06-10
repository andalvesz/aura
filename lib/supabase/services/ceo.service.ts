import OpenAI from "openai";
import { GoalsRepository } from "@/lib/supabase/repositories/goals.repository";
import { AuraCeoSessionsRepository } from "@/lib/supabase/repositories/ceo.repository";
import { getAuraCentralFinanceContext } from "@/lib/supabase/services/central.service";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { getEnglishCoachMentorContext } from "@/lib/supabase/services/english-coach.service";
import { listUpcomingEventos } from "@/lib/supabase/services/eventos.service";
import { listGrowthMissions } from "@/lib/supabase/services/growth.service";
import { getHealthCoachMentorContext } from "@/lib/supabase/services/health-coach.service";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import { loadLaunchPlans } from "@/lib/supabase/services/launch.service";
import { getMoneyDashboard } from "@/lib/supabase/services/money.service";
import { getNexusAlveszMentorContext } from "@/lib/supabase/services/nexus.service";
import { getAutopilotContext } from "@/lib/supabase/services/autopilot.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import { getSocialIaMentorContext } from "@/lib/supabase/services/social-ia.service";
import { listTrips } from "@/lib/supabase/services/travel.service";
import { getAuraXpState } from "@/lib/supabase/services/xp.service";
import type { AuraCeoSession, TableInsert } from "@/types/database";
import {
  buildCeoAuraContext,
  computeOpportunityRadarFromData,
  normalizeGeneratedRadar,
  parseOpportunityRadar,
  type CeoDashboardMetrics,
  type CeoOpportunityRadar,
  type GeneratedCeoPlan,
} from "@/utils/ceo";
import { getTodayMissions } from "@/utils/money";
import { formatBRL } from "@/utils/format";
import { rankProductsForLaunch } from "@/utils/creator";
import {
  buildBudgetAiRules,
  buildBudgetAskReply,
  mentionsCampaignInvestment,
} from "@/utils/campaign-budget";
import { buildCeoAiContext } from "@/utils/creator-locale";
import {
  buildBudgetContextBlock,
  getResolvedUserBudget,
} from "./campaign-budget.service";
import { getOptionalDataContext } from "./context";
import { getPlatformsContext } from "./platform-hub.service";
import { getGlobalContext } from "./global-intelligence.service";

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

async function callCeoAi<T>(system: string, user: string): Promise<T | null> {
  const openai = getOpenAi();
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) return null;
  return parseJsonBlock<T>(content);
}

async function getMetasContext(): Promise<string> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return "";

  const today = new Date().toISOString().slice(0, 10);
  const goalsRepo = new GoalsRepository(ctx.supabase, ctx.userId);
  const { data: goals } = await goalsRepo.findActive(today);

  if (!goals?.length) return "Nenhuma meta ativa.";

  return goals
    .slice(0, 8)
    .map((g) => `• ${g.titulo} (${g.tipo}): ${g.atual}/${g.meta}`)
    .join("\n");
}

async function loadAllModuleContexts() {
  const [
    legacy,
    finance,
    money,
    metas,
    creator,
    research,
    copylab,
    launch,
    social,
    alvesz,
    health,
    english,
    trips,
    eventos,
    growthMissions,
    autopilot,
    platforms,
    globalIntel,
  ] = await Promise.all([
    getLegacyContext(),
    getAuraCentralFinanceContext(),
    getMoneyDashboard(),
    getMetasContext(),
    loadCreatorBundles(),
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
    getAutopilotContext(),
    getPlatformsContext(),
    getGlobalContext(),
  ]);

  return {
    legacy: legacy.context ?? "",
    finance: finance.context ?? "",
    money: money.plan
      ? `Meta: ${formatBRL(Number(money.plan.valor_meta))} · Progresso: ${formatBRL(Number(money.plan.valor_conquistado))}`
      : "Nenhum plano Money Missions ativo.",
    moneyTasks: getTodayMissions(money.tasks)
      .map((t) => t.titulo)
      .join(", "),
    metas,
    creator: creator.bundles,
    creatorSummary: creator.bundles
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
      eventos.data
        ?.slice(0, 5)
        .map((e) => `• ${e.titulo} — ${e.data_inicio}`)
        .join("\n") || "Nenhum evento próximo.",
    growthMissions:
      growthMissions.data
        ?.filter((m) => m.status === "pending" && m.mission_date === new Date().toISOString().slice(0, 10))
        .slice(0, 3)
        .map((m) => m.titulo)
        .join(", ") || "",
    autopilot: autopilot.context ?? "Nenhuma campanha no Autopilot.",
    platforms: platforms.context ?? "",
    global: globalIntel.context ?? "",
  };
}

async function computeDashboard(
  moduleData: Awaited<ReturnType<typeof loadAllModuleContexts>>
): Promise<CeoDashboardMetrics> {
  const { state: xpState } = await getAuraXpState();
  const { plan: moneyPlan, tasks: moneyTasks } = await getMoneyDashboard();

  const ranked = rankProductsForLaunch(moduleData.creator);
  const mainProject = ranked[0]?.product.nome ?? ranked[0]?.product.nicho ?? "Nenhum projeto ativo";

  const todayMission =
    moduleData.moneyTasks ||
    moduleData.growthMissions ||
    "Defina prioridades no Aura CEO";

  let proximoMarco = "—";
  const ctx = await getOptionalDataContext();
  if (ctx) {
    const today = new Date().toISOString().slice(0, 10);
    const goalsRepo = new GoalsRepository(ctx.supabase, ctx.userId);
    const { data: goals } = await goalsRepo.findActive(today);
    const next = goals?.find((g) => g.atual < g.meta);
    if (next) {
      proximoMarco = `${next.titulo} (${next.atual}/${next.meta})`;
    }
  }

  const upcoming = moduleData.eventos.split("\n")[0]?.replace("• ", "");
  if (proximoMarco === "—" && upcoming) {
    proximoMarco = upcoming;
  }

  return {
    metaFinanceiraAtiva: moneyPlan
      ? `${formatBRL(Number(moneyPlan.valor_meta))} em ${moneyPlan.prazo.replace("_", " ")}`
      : "Nenhuma meta ativa",
    projetoPrincipal: mainProject,
    missaoDoDia: todayMission,
    xpAtual: xpState?.userXp.xp_total ?? 0,
    xpNivel: xpState?.userXp.nivel ?? 1,
    valorConquistado: moneyPlan ? Number(moneyPlan.valor_conquistado) : 0,
    proximoMarco,
  };
}

export async function getCeoDashboard(): Promise<{
  dashboard: CeoDashboardMetrics | null;
  session: AuraCeoSession | null;
  radar: CeoOpportunityRadar | null;
  sessions: AuraCeoSession[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      dashboard: null,
      session: null,
      radar: null,
      sessions: [],
      error: "Usuário não autenticado.",
    };
  }

  const repo = new AuraCeoSessionsRepository(ctx.supabase, ctx.userId);
  const moduleData = await loadAllModuleContexts();

  const [{ data: session }, { data: sessions }] = await Promise.all([
    repo.findActive(),
    repo.findAllOrdered(),
  ]);

  const dashboard = await computeDashboard(moduleData);

  const baseRadar = computeOpportunityRadarFromData({
    bundles: moduleData.creator,
    research: moduleData.research,
    legacySummary: moduleData.legacy.slice(0, 200),
  });

  const radar =
    session?.opportunity_radar && parseOpportunityRadar(session.opportunity_radar)
      ? { ...baseRadar, ...parseOpportunityRadar(session.opportunity_radar)!, scoreIa: session.score_ia ?? baseRadar.scoreIa }
      : baseRadar;

  return {
    dashboard,
    session: session ?? null,
    radar,
    sessions: sessions ?? [],
    error: null,
  };
}

export async function getCeoContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ dashboard, session, radar }, moduleData] = await Promise.all([
    getCeoDashboard(),
    loadAllModuleContexts(),
  ]);

  if (!dashboard || !radar) {
    return { context: "", error: "Erro ao carregar dashboard CEO." };
  }

  const lines = [
    "## AURA CEO",
    buildCeoAuraContext(session, dashboard, radar),
    moduleData.legacy ? `## LEGADO\n${moduleData.legacy}` : "",
    moduleData.finance ? `## FINANCEIRO\n${moduleData.finance}` : "",
    moduleData.money ? `## MONEY MISSIONS\n${moduleData.money}` : "",
    moduleData.metas ? `## METAS\n${moduleData.metas}` : "",
    moduleData.creatorSummary ? `## CREATOR\n${moduleData.creatorSummary}` : "",
    moduleData.researchSummary ? `## MARKET RESEARCH\n${moduleData.researchSummary}` : "",
    moduleData.copylab ? `## COPYLAB\n${moduleData.copylab}` : "",
    moduleData.launch ? `## LAUNCH CENTER\n${moduleData.launch}` : "",
    moduleData.autopilot ? `## AUTOPILOT\n${moduleData.autopilot}` : "",
    moduleData.platforms ? `## PLATFORM HUB\n${moduleData.platforms}` : "",
    moduleData.global ? `## GLOBAL INTELLIGENCE\n${moduleData.global}` : "",
    moduleData.social ? `## SOCIAL MEDIA\n${moduleData.social}` : "",
    moduleData.alvesz ? `## ALVESZ EXPERIENCE\n${moduleData.alvesz}` : "",
    moduleData.english ? `## IDIOMAS\n${moduleData.english}` : "",
    moduleData.trips ? `## VIAGENS\n${moduleData.trips}` : "",
    moduleData.health ? `## SAÚDE\n${moduleData.health}` : "",
    moduleData.eventos ? `## CALENDÁRIO\n${moduleData.eventos}` : "",
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: null };
}

export async function createCeoPlan(pergunta: string): Promise<{
  session: AuraCeoSession | null;
  radar: CeoOpportunityRadar | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { session: null, radar: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) {
    return { session: null, radar: null, error: "IA indisponível (OPENAI_API_KEY)." };
  }

  const trimmed = pergunta.trim();
  if (!trimmed) {
    return { session: null, radar: null, error: "Informe sua pergunta estratégica." };
  }

  const moduleData = await loadAllModuleContexts();
  const baseRadar = computeOpportunityRadarFromData({
    bundles: moduleData.creator,
    research: moduleData.research,
    legacySummary: moduleData.legacy.slice(0, 200),
  });

  const { budget } = await getResolvedUserBudget();
  const budgetBlock = buildBudgetContextBlock(budget.orcamento);
  const campaignQuestion = mentionsCampaignInvestment(trimmed);

  if (campaignQuestion && (budget.orcamento == null || budget.orcamento <= 0)) {
    return { session: null, radar: null, error: buildBudgetAskReply() };
  }

  const generated = await callCeoAi<GeneratedCeoPlan>(
    `${buildCeoAiContext()}
${campaignQuestion ? buildBudgetAiRules(budget.orcamento) : ""}
Responda APENAS JSON:
{
  "resumo_executivo": string,
  "prioridades": string[],
  "riscos": string[],
  "oportunidades": string[],
  "plano_acao": string,
  "cronograma": [{ "semana": number, "foco": string, "tarefas": string[] }],
  "missoes_recomendadas": [{ "titulo": string, "descricao": string, "modulo": string }],
  "probabilidade_sucesso": number,
  "opportunity_radar": {
    "melhor_oportunidade": { "titulo": string, "descricao": string, "score": number, "modulo": string, "pais_recomendado": string, "idioma_recomendado": string, "moeda_recomendada": string, "motivo_estrategico": string },
    "mais_lucrativo": { "titulo": string, "descricao": string, "score": number, "modulo": string, "pais_recomendado": string, "idioma_recomendado": string, "moeda_recomendada": string, "motivo_estrategico": string },
    "mais_rapido": { "titulo": string, "descricao": string, "score": number, "modulo": string, "pais_recomendado": string, "idioma_recomendado": string, "moeda_recomendada": string, "motivo_estrategico": string },
    "mais_alinhado_legado": { "titulo": string, "descricao": string, "score": number, "modulo": string, "pais_recomendado": string, "idioma_recomendado": string, "moeda_recomendada": string, "motivo_estrategico": string },
    "mais_escalavel": { "titulo": string, "descricao": string, "score": number, "modulo": string, "pais_recomendado": string, "idioma_recomendado": string, "moeda_recomendada": string, "motivo_estrategico": string },
    "score_ia": number
  }
}
Regras:
- 4 semanas no cronograma, 3-4 tarefas por semana
- 5-8 prioridades ordenadas
- 3-5 riscos e oportunidades
- 5-8 missões recomendadas com módulo (creator, money, alvesz, etc.)
- scores 0-100 no radar
- probabilidade_sucesso 0-100
- Ao sugerir produtos internacionais no radar, preencha pais_recomendado, idioma_recomendado, moeda_recomendada e motivo_estrategico`,
    JSON.stringify({
      pergunta: trimmed,
      radarBase: baseRadar,
      budget: budgetBlock,
      ...moduleData,
    })
  );

  if (!generated?.resumo_executivo) {
    return { session: null, radar: null, error: "Não foi possível gerar o plano estratégico." };
  }

  const radar = normalizeGeneratedRadar(generated.opportunity_radar);
  const repo = new AuraCeoSessionsRepository(ctx.supabase, ctx.userId);
  await repo.archiveActive();

  const { data: session, error: createError } = await repo.create({
    pergunta: trimmed,
    resumo_executivo: generated.resumo_executivo,
    prioridades: generated.prioridades,
    riscos: generated.riscos,
    oportunidades: generated.oportunidades,
    plano_acao: generated.plano_acao,
    cronograma: generated.cronograma,
    missoes_recomendadas: generated.missoes_recomendadas,
    probabilidade_sucesso: generated.probabilidade_sucesso,
    opportunity_radar: radar,
    score_ia: radar.scoreIa,
    status: "active",
  } satisfies Omit<TableInsert<"aura_ceo_sessions">, "user_id">);

  if (createError || !session) {
    return { session: null, radar: null, error: createError ?? "Erro ao salvar sessão." };
  }

  return { session: session as AuraCeoSession, radar, error: null };
}

export async function deleteCeoSession(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new AuraCeoSessionsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
