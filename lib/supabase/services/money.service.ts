import OpenAI from "openai";
import { GoalsRepository } from "@/lib/supabase/repositories/goals.repository";
import {
  MoneyMissionPlansRepository,
} from "@/lib/supabase/repositories/money.repository";
import {
  MoneyMissionTasksRepository,
} from "@/lib/supabase/repositories/money-tasks.repository";
import { getAuraCentralFinanceContext } from "@/lib/supabase/services/central.service";
import { loadCopylabRecords } from "@/lib/supabase/services/copylab.service";
import { loadCreatorBundles } from "@/lib/supabase/services/creator.service";
import { getLegacyContext } from "@/lib/supabase/services/legado.service";
import { loadLaunchPlans } from "@/lib/supabase/services/launch.service";
import { getNexusAlveszMentorContext } from "@/lib/supabase/services/nexus.service";
import { loadResearchRecords } from "@/lib/supabase/services/research.service";
import { getSocialIaMentorContext } from "@/lib/supabase/services/social-ia.service";
import type {
  MoneyMissionPlan,
  MoneyMissionTask,
  TableInsert,
} from "@/types/database";
import {
  buildMoneyAuraContext,
  computeDataFim,
  computeMoneyDashboard,
  type GeneratedMoneyPlan,
  type MoneyDashboardMetrics,
  type MoneyPrazo,
  type MoneyPrioridade,
} from "@/utils/money";
import {
  buildBudgetAiRules,
  clampInvestimentoToBudget,
  parseBudgetInput,
} from "@/utils/campaign-budget";
import {
  buildMoneyAiContext,
  resolveCreatorLocale,
  type CreatorCurrency,
} from "@/utils/creator-locale";
import { getOptionalDataContext } from "./context";
import { getPlatformsContext } from "./platform-hub.service";
import { getGlobalContext } from "./global-intelligence.service";
import { getKnowledgeContext } from "./knowledge.service";

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

async function callMoneyAi<T>(system: string, user: string): Promise<T | null> {
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
  const vendas = (goals ?? []).filter(
    (g) => g.tipo === "vendas" || g.tipo === "financeira"
  );

  if (!vendas.length) return "Nenhuma meta de vendas ativa.";

  return vendas
    .slice(0, 5)
    .map((g) => `• ${g.titulo}: ${g.atual}/${g.meta} (${g.data_inicio} → ${g.data_fim})`)
    .join("\n");
}

async function loadAllModuleContexts() {
  const [
    legacy,
    finance,
    metas,
    creator,
    research,
    copylab,
    launch,
    social,
    alvesz,
    platforms,
    globalIntel,
    knowledgeIntel,
  ] = await Promise.all([
    getLegacyContext(),
    getAuraCentralFinanceContext(),
    getMetasContext(),
    loadCreatorBundles(),
    loadResearchRecords(),
    loadCopylabRecords(),
    loadLaunchPlans(),
    getSocialIaMentorContext(),
    getNexusAlveszMentorContext(),
    getPlatformsContext(),
    getGlobalContext(),
    getKnowledgeContext(),
  ]);

  return {
    legacy: legacy.context ?? "",
    finance: finance.context ?? "",
    metas,
    creator: creator.bundles
      .slice(0, 5)
      .map((b) => `• ${b.product.nome} (${b.product.status})`)
      .join("\n") || "Nenhum produto Creator.",
    research:
      research.records
        .slice(0, 3)
        .map((r) => `• ${r.nicho ?? r.ideia_input ?? "Ideia"}: nota ${r.nota_final ?? "—"}`)
        .join("\n") || "Nenhuma pesquisa.",
    copylab:
      copylab.records
        .slice(0, 3)
        .map((c) => `• ${c.nome ?? c.headline ?? "Copy"}: ${c.preco ? `R$ ${c.preco}` : "—"}`)
        .join("\n") || "Nenhum copy.",
    launch:
      launch.plans
        .slice(0, 3)
        .map((p) => `• ${p.titulo ?? "Plano"}: score ${p.score_ia ?? "—"}`)
        .join("\n") || "Nenhum plano de lançamento.",
    social: social.context ?? "",
    alvesz: alvesz.context ?? "",
    platforms: platforms.context ?? "",
    global: globalIntel.context ?? "",
    knowledge: knowledgeIntel.context ?? "",
  };
}

export async function loadMoneyPlans(): Promise<{
  plans: MoneyMissionPlan[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { plans: [], error: "Usuário não autenticado." };

  const repo = new MoneyMissionPlansRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAllOrdered();
  if (error) return { plans: [], error };
  return { plans: data ?? [], error: null };
}

export async function loadMoneyTasks(planId: string): Promise<{
  tasks: MoneyMissionTask[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { tasks: [], error: "Usuário não autenticado." };

  const repo = new MoneyMissionTasksRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findByPlanId(planId);
  if (error) return { tasks: [], error };
  return { tasks: data ?? [], error: null };
}

async function loadMoneyState(): Promise<{
  plan: MoneyMissionPlan | null;
  tasks: MoneyMissionTask[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { plan: null, tasks: [], error: "Usuário não autenticado." };

  const plansRepo = new MoneyMissionPlansRepository(ctx.supabase, ctx.userId);
  const { data: plan, error: planError } = await plansRepo.findActive();
  if (planError) return { plan: null, tasks: [], error: planError };
  if (!plan) return { plan: null, tasks: [], error: null };

  const tasksRepo = new MoneyMissionTasksRepository(ctx.supabase, ctx.userId);
  const { data: tasks, error: tasksError } = await tasksRepo.findByPlanId(plan.id);
  if (tasksError) return { plan, tasks: [], error: tasksError };

  return { plan, tasks: tasks ?? [], error: null };
}

export async function getMoneyDashboard(): Promise<{
  dashboard: MoneyDashboardMetrics | null;
  plan: MoneyMissionPlan | null;
  tasks: MoneyMissionTask[];
  error: string | null;
}> {
  const { plan, tasks, error } = await loadMoneyState();
  if (error) return { dashboard: null, plan: null, tasks: [], error };

  return {
    dashboard: computeMoneyDashboard(plan, tasks),
    plan,
    tasks,
    error: null,
  };
}

export async function getMoneyContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ plan, tasks }, moduleContexts] = await Promise.all([
    loadMoneyState(),
    loadAllModuleContexts(),
  ]);

  const dashboard = computeMoneyDashboard(plan, tasks);
  const lines = [
    "## AURA MONEY MISSIONS",
    buildMoneyAuraContext(plan, tasks, dashboard),
    moduleContexts.legacy ? `## LEGADO\n${moduleContexts.legacy}` : "",
    moduleContexts.finance ? `## FINANCEIRO\n${moduleContexts.finance}` : "",
    moduleContexts.metas ? `## METAS\n${moduleContexts.metas}` : "",
    moduleContexts.creator ? `## CREATOR\n${moduleContexts.creator}` : "",
    moduleContexts.research ? `## MARKET RESEARCH\n${moduleContexts.research}` : "",
    moduleContexts.copylab ? `## COPYLAB\n${moduleContexts.copylab}` : "",
    moduleContexts.launch ? `## LAUNCH CENTER\n${moduleContexts.launch}` : "",
    moduleContexts.social ? `## SOCIAL MEDIA\n${moduleContexts.social}` : "",
    moduleContexts.alvesz ? `## ALVESZ EXPERIENCE\n${moduleContexts.alvesz}` : "",
    moduleContexts.platforms ? `## PLATFORM HUB\n${moduleContexts.platforms}` : "",
    moduleContexts.global ? `## GLOBAL INTELLIGENCE\n${moduleContexts.global}` : "",
    moduleContexts.knowledge ? `## KNOWLEDGE & CONNECT\n${moduleContexts.knowledge}` : "",
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: null };
}

function buildTasksFromPlan(
  planId: string,
  generated: GeneratedMoneyPlan
): Omit<TableInsert<"money_mission_tasks">, "user_id">[] {
  const tasks: Omit<TableInsert<"money_mission_tasks">, "user_id">[] = [];
  let ordem = 0;

  for (const semana of generated.cronograma) {
    for (const titulo of semana.tarefas) {
      tasks.push({
        plan_id: planId,
        mission_key: `semana-${semana.semana}-${ordem}`,
        titulo,
        descricao: `Semana ${semana.semana}: ${semana.foco}`,
        semana: semana.semana,
        ordem: ordem++,
        tipo: "semanal",
        status: "pending",
        xp_reward: 20,
      });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const [idx, missao] of generated.missoes_diarias.entries()) {
    tasks.push({
      plan_id: planId,
      mission_key: `diaria-${today}-${idx}`,
      titulo: missao.titulo,
      descricao: missao.descricao,
      ordem: ordem++,
      tipo: "diaria",
      status: "pending",
      mission_date: today,
      xp_reward: 15,
    });
  }

  return tasks;
}

export async function startMoneyMission(params: {
  valorMeta: number;
  prazo: MoneyPrazo;
  prioridade: MoneyPrioridade;
  orcamento_disponivel?: number | null;
  currency?: CreatorCurrency;
}): Promise<{
  plan: MoneyMissionPlan | null;
  tasks: MoneyMissionTask[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { plan: null, tasks: [], error: "Usuário não autenticado." };
  if (!getOpenAi()) {
    return { plan: null, tasks: [], error: "IA indisponível (OPENAI_API_KEY)." };
  }

  const { valorMeta, prazo, prioridade } = params;
  const currency = resolveCreatorLocale({ currency: params.currency }).currency;
  if (!valorMeta || valorMeta <= 0) {
    return { plan: null, tasks: [], error: "Informe um valor meta válido." };
  }

  const orcamentoDisponivel = parseBudgetInput(params.orcamento_disponivel ?? null);
  if (orcamentoDisponivel == null) {
    return {
      plan: null,
      tasks: [],
      error: "Informe seu Orçamento disponível antes de gerar o plano.",
    };
  }

  const moduleContexts = await loadAllModuleContexts();
  const dataInicio = new Date().toISOString().slice(0, 10);
  const dataFim = computeDataFim(dataInicio, prazo);

  const generated = await callMoneyAi<GeneratedMoneyPlan>(
    `${buildMoneyAiContext(currency)}
Analise todos os módulos da Aura (Legado, Creator, Research, CopyLab, Launch, Financeiro, Metas, Social Media, Alvesz).
${buildBudgetAiRules(orcamentoDisponivel, currency)}
Responda APENAS JSON:
{
  "plano_financeiro": string,
  "produtos_recomendados": string[],
  "servicos_recomendados": string[],
  "receita_estimada": number,
  "investimento_necessario": number,
  "roi_estimado": number,
  "riscos": string[],
  "probabilidade_sucesso": number,
  "cronograma": [{ "semana": number, "foco": string, "tarefas": string[] }],
  "missoes_diarias": [{ "titulo": string, "descricao": string }]
}
Regras:
- cronograma com 4 semanas, 3-4 tarefas por semana
- missoes_diarias com 3-5 missões para hoje
- probabilidade_sucesso 0-100
- valores em ${currency}
- prioridade do usuário: ${prioridade}
- meta: ${valorMeta} ${currency} em ${prazo}`,
    JSON.stringify({
      valorMeta,
      prazo,
      prioridade,
      orcamento_disponivel: orcamentoDisponivel,
      dataInicio,
      dataFim,
      ...moduleContexts,
    })
  );

  if (!generated?.plano_financeiro) {
    return { plan: null, tasks: [], error: "Não foi possível gerar o plano financeiro." };
  }

  const investimentoNecessario = clampInvestimentoToBudget(
    generated.investimento_necessario,
    orcamentoDisponivel
  );

  const plansRepo = new MoneyMissionPlansRepository(ctx.supabase, ctx.userId);
  await plansRepo.archiveActive();

  const { data: plan, error: createError } = await plansRepo.create({
    valor_meta: valorMeta,
    prazo,
    prioridade,
    data_inicio: dataInicio,
    data_fim: dataFim,
    status: "active",
    plano_financeiro: generated.plano_financeiro,
    produtos_recomendados: generated.produtos_recomendados,
    servicos_recomendados: generated.servicos_recomendados,
    receita_estimada: generated.receita_estimada,
    investimento_necessario: investimentoNecessario,
    orcamento_disponivel: orcamentoDisponivel,
    roi_estimado: generated.roi_estimado,
    riscos: generated.riscos,
    probabilidade_sucesso: generated.probabilidade_sucesso,
    cronograma: generated.cronograma,
    currency,
  } satisfies Omit<TableInsert<"money_mission_plans">, "user_id">);

  if (createError || !plan) {
    return { plan: null, tasks: [], error: createError ?? "Erro ao salvar plano." };
  }

  const taskPayloads = buildTasksFromPlan(plan.id, generated);
  const tasksRepo = new MoneyMissionTasksRepository(ctx.supabase, ctx.userId);
  const { data: tasks, error: tasksError } = await tasksRepo.createMany(taskPayloads);

  if (tasksError) {
    return { plan: plan as MoneyMissionPlan, tasks: [], error: tasksError };
  }

  return { plan: plan as MoneyMissionPlan, tasks: tasks ?? [], error: null };
}

export async function completeMoneyMissionTask(taskId: string): Promise<{
  task: MoneyMissionTask | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { task: null, error: "Usuário não autenticado." };

  const tasksRepo = new MoneyMissionTasksRepository(ctx.supabase, ctx.userId);
  const { data: task, error } = await tasksRepo.update(taskId, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  if (error || !task) {
    return { task: null, error: error ?? "Erro ao concluir missão." };
  }

  return { task: task as MoneyMissionTask, error: null };
}

export async function updateMoneyProgress(valorConquistado: number): Promise<{
  plan: MoneyMissionPlan | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { plan: null, error: "Usuário não autenticado." };

  const plansRepo = new MoneyMissionPlansRepository(ctx.supabase, ctx.userId);
  const { data: active, error: findError } = await plansRepo.findActive();
  if (findError || !active) {
    return { plan: null, error: findError ?? "Nenhum plano ativo." };
  }

  const meta = Number(active.valor_meta);
  const status = valorConquistado >= meta ? "completed" : "active";

  const { data: plan, error } = await plansRepo.update(active.id, {
    valor_conquistado: valorConquistado,
    status,
  });

  if (error || !plan) {
    return { plan: null, error: error ?? "Erro ao atualizar progresso." };
  }

  return { plan: plan as MoneyMissionPlan, error: null };
}

export async function deleteMoneyPlan(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new MoneyMissionPlansRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
