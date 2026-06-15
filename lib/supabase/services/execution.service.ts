import OpenAI from "openai";
import { saveAuraMemory } from "@/lib/supabase/services/ai-memories.service";
import { getOrchestratorContext } from "@/lib/supabase/services/campaign-orchestrator.service";
import { buildAuraContext } from "@/lib/supabase/services/aura-brain.service";
import {
  completeMoneyMissionTask,
} from "@/lib/supabase/services/money.service";
import { awardAuraXp } from "@/lib/supabase/services/xp.service";
import { ExecutionHistoryRepository } from "@/lib/supabase/repositories/execution-history.repository";
import { ExecutionTasksRepository } from "@/lib/supabase/repositories/execution-tasks.repository";
import { ExecutionPlansRepository } from "@/lib/supabase/repositories/execution.repository";
import type {
  ExecutionHistoryEntry,
  ExecutionPlan,
  ExecutionTask,
  TableInsert,
} from "@/types/database";
import { rankProductsForLaunch } from "@/utils/creator";
import {
  buildExecutionAuraContext,
  buildGreeting,
  computeExecutionDashboard,
  type DailyBriefing,
  type ExecutionDashboardMetrics,
  type GeneratedDailyPlan,
  parseBriefing,
} from "@/utils/execution";
import {
  type OperationCenterDashboard,
  type OperationStepId,
} from "@/utils/operation-center";
import { todayIsoDate } from "@/utils/health";
import { getOptionalDataContext, resolveUserDisplayName } from "./context";

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

async function callExecutionAi<T>(system: string, user: string): Promise<T | null> {
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

const SYSTEM_PROMPT = `Você é a Aura Execution Engine — transforma planos de todos os módulos em tarefas executáveis.
Responda APENAS JSON:
{
  "titulo": string,
  "resumo": string,
  "score_execucao": number,
  "briefing": {
    "projeto_prioritario": string,
    "meta_financeira": string,
    "probabilidade_atual": number,
    "conselho_ceo": string
  },
  "missoes_diarias": [
    {
      "task_key": string,
      "titulo": string,
      "descricao": string,
      "categoria": "diaria",
      "area": "marketing" | "negocios" | "saude" | "desenvolvimento" | "relacionamentos",
      "modulo_origem": "ceo" | "money" | "orchestrator" | "launch" | "creator" | "social" | "alvesz" | "financeiro" | "calendario" | "saude" | "idiomas",
      "prioridade": number,
      "impacto": number,
      "urgencia": number,
      "roi": number,
      "energia": number,
      "href": string,
      "source_ref": string
    }
  ],
  "missoes_semanais": [
    {
      "task_key": string,
      "titulo": string,
      "descricao": string,
      "categoria": "semanal",
      "area": "marketing" | "negocios" | "saude" | "desenvolvimento" | "relacionamentos",
      "modulo_origem": string,
      "prioridade": number,
      "impacto": number,
      "urgencia": number,
      "roi": number,
      "energia": number,
      "href": string,
      "semana": number
    }
  ]
}
Regras:
- 5-8 missões diárias cobrindo módulos ativos
- 5-10 missões semanais distribuídas nas 5 áreas
- prioridade, impacto, urgencia: 0-100
- energia: 1-5 (1=leve, 5=intenso)
- roi em percentual estimado
- href: rota do módulo (/dashboard/creator, /dashboard/saude, etc.)
- conselho_ceo: frase estratégica personalizada
- Português do Brasil`;

async function loadAllModuleContexts() {
  const [brain, orchestrator] = await Promise.all([
    buildAuraContext(),
    getOrchestratorContext(),
  ]);

  const md = brain.moduleData;
  const topProduct = rankProductsForLaunch(md.creator)[0];

  return {
    ceo: brain.sections.execucao.split("\n")[0] ?? "Nenhuma sessão CEO.",
    money: md.money,
    moneyTasks: md.moneyTasks,
    orchestrator: orchestrator.context?.slice(0, 400) ?? "Sem orquestração.",
    creator: topProduct
      ? `Produto prioritário: ${topProduct.product.nome} (${topProduct.product.status})`
      : "Nenhum produto Creator.",
    research: md.researchSummary,
    copylab: md.copylab,
    launch: md.launch,
    social: md.social.slice(0, 300),
    alvesz: md.alvesz.slice(0, 300),
    financeiro: md.finance.slice(0, 300),
    calendario: md.eventos,
    saude: md.health.slice(0, 300),
    idiomas: md.english.slice(0, 300),
    metaFinanceira: topProduct?.product.objetivo_financeiro ?? null,
    probabilidade: topProduct?.validation?.nota_final ?? 0,
    brain: brain.context,
  };
}

async function loadExecutionState(planDate?: string): Promise<{
  plan: ExecutionPlan | null;
  tasks: ExecutionTask[];
  history: ExecutionHistoryEntry[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { plan: null, tasks: [], history: [], error: "Usuário não autenticado." };
  }

  const today = planDate ?? todayIsoDate();
  const plansRepo = new ExecutionPlansRepository(ctx.supabase, ctx.userId);
  const { data: plan, error: planError } = await plansRepo.findByDate(today);
  if (planError) return { plan: null, tasks: [], history: [], error: planError };
  if (!plan) return { plan: null, tasks: [], history: [], error: null };

  const tasksRepo = new ExecutionTasksRepository(ctx.supabase, ctx.userId);
  const historyRepo = new ExecutionHistoryRepository(ctx.supabase, ctx.userId);

  const [{ data: tasks, error: tasksError }, { data: history }] = await Promise.all([
    tasksRepo.findByPlanId(plan.id),
    historyRepo.findSince(today),
  ]);

  if (tasksError) return { plan, tasks: [], history: [], error: tasksError };

  return { plan, tasks: tasks ?? [], history: history ?? [], error: null };
}

export async function getExecutionDashboard(): Promise<{
  dashboard: ExecutionDashboardMetrics | null;
  plan: ExecutionPlan | null;
  tasks: ExecutionTask[];
  briefing: DailyBriefing | null;
  history: ExecutionHistoryEntry[];
  error: string | null;
}> {
  const { plan, tasks, history, error } = await loadExecutionState();
  if (error) {
    return { dashboard: null, plan: null, tasks: [], briefing: null, history: [], error };
  }

  const dashboard = computeExecutionDashboard(plan, tasks, history);
  const ctx = await getOptionalDataContext();
  const displayName = ctx ? await resolveUserDisplayName(ctx) : "Anderson";
  const rawBriefing = plan ? parseBriefing(plan.briefing) : null;

  const briefing: DailyBriefing | null = rawBriefing
    ? {
        ...rawBriefing,
        greeting: buildGreeting(displayName),
        display_name: displayName,
      }
    : null;

  return { dashboard, plan, tasks, briefing, history, error: null };
}

export async function getExecutionContext(): Promise<{ context: string; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { context: "", error: "Usuário não autenticado." };

  const [{ plan, tasks, history }, brain] = await Promise.all([
    loadExecutionState(),
    buildAuraContext(),
  ]);
  const dashboard = computeExecutionDashboard(plan, tasks, history);
  const md = brain.moduleData;

  const lines = [
    brain.context ? brain.context : "",
    "## AURA EXECUTION ENGINE",
    buildExecutionAuraContext(plan, tasks, dashboard),
    md.platforms ? `## PLATFORM HUB\n${md.platforms}` : "",
    md.global ? `## GLOBAL INTELLIGENCE\n${md.global}` : "",
    md.knowledge ? `## KNOWLEDGE & CONNECT\n${md.knowledge}` : "",
  ].filter(Boolean);

  return { context: lines.join("\n\n"), error: null };
}

function buildTasksFromPlan(
  planId: string,
  planDate: string,
  generated: GeneratedDailyPlan
): Omit<TableInsert<"execution_tasks">, "user_id">[] {
  const tasks: Omit<TableInsert<"execution_tasks">, "user_id">[] = [];
  let ordem = 0;

  for (const m of generated.missoes_diarias) {
    tasks.push({
      plan_id: planId,
      task_key: m.task_key || `diaria-${ordem}`,
      titulo: m.titulo,
      descricao: m.descricao ?? "",
      categoria: "diaria",
      area: m.area,
      modulo_origem: m.modulo_origem,
      prioridade: m.prioridade,
      impacto: m.impacto,
      urgencia: m.urgencia,
      roi: m.roi,
      energia: m.energia,
      href: m.href ?? null,
      source_ref: m.source_ref ?? null,
      status: "pending",
      task_date: planDate,
      ordem: ordem++,
      xp_reward: 15,
    });
  }

  for (const m of generated.missoes_semanais) {
    tasks.push({
      plan_id: planId,
      task_key: m.task_key || `semanal-${ordem}`,
      titulo: m.titulo,
      descricao: m.descricao ?? "",
      categoria: "semanal",
      area: m.area,
      modulo_origem: m.modulo_origem,
      prioridade: m.prioridade,
      impacto: m.impacto,
      urgencia: m.urgencia,
      roi: m.roi,
      energia: m.energia,
      href: m.href ?? null,
      source_ref: m.source_ref ?? null,
      status: "pending",
      semana: m.semana ?? 1,
      ordem: ordem++,
      xp_reward: 20,
    });
  }

  return tasks;
}

export async function generateDailyPlan(): Promise<{
  plan: ExecutionPlan | null;
  tasks: ExecutionTask[];
  briefing: DailyBriefing | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { plan: null, tasks: [], briefing: null, error: "Usuário não autenticado." };
  if (!getOpenAi()) {
    return { plan: null, tasks: [], briefing: null, error: "IA indisponível (OPENAI_API_KEY)." };
  }

  const today = todayIsoDate();
  const displayName = await resolveUserDisplayName(ctx);
  const moduleContexts = await loadAllModuleContexts();

  const generated = await callExecutionAi<GeneratedDailyPlan>(
    SYSTEM_PROMPT,
    JSON.stringify({
      data: today,
      displayName,
      modulos: moduleContexts,
      areas: ["marketing", "negocios", "saude", "desenvolvimento", "relacionamentos"],
    })
  );

  if (!generated?.titulo) {
    return { plan: null, tasks: [], briefing: null, error: "Não foi possível gerar o plano diário." };
  }

  const plansRepo = new ExecutionPlansRepository(ctx.supabase, ctx.userId);
  const tasksRepo = new ExecutionTasksRepository(ctx.supabase, ctx.userId);

  const existing = await plansRepo.findByDate(today);
  if (existing.data) {
    await tasksRepo.deleteByPlanId(existing.data.id);
    await plansRepo.delete(existing.data.id);
  }

  const taskPayloads = buildTasksFromPlan("", today, generated);
  const totalTasks = taskPayloads.length;

  const briefingData: DailyBriefing = {
    greeting: buildGreeting(displayName),
    display_name: displayName,
    projeto_prioritario: generated.briefing.projeto_prioritario,
    meta_financeira: generated.briefing.meta_financeira,
    probabilidade_atual: generated.briefing.probabilidade_atual,
    conselho_ceo: generated.briefing.conselho_ceo,
  };

  const { data: plan, error: createError } = await plansRepo.create({
    plan_date: today,
    titulo: generated.titulo,
    status: "active",
    briefing: briefingData,
    score_execucao: generated.score_execucao,
    missoes_concluidas: 0,
    missoes_total: totalTasks,
    resumo: generated.resumo,
  } satisfies Omit<TableInsert<"execution_plans">, "user_id">);

  if (createError || !plan) {
    return { plan: null, tasks: [], briefing: null, error: createError ?? "Erro ao salvar plano." };
  }

  const payloads = buildTasksFromPlan(plan.id, today, generated);
  const { data: tasks, error: tasksError } = await tasksRepo.createMany(payloads);

  if (tasksError) {
    return { plan: plan as ExecutionPlan, tasks: [], briefing: briefingData, error: tasksError };
  }

  const historyRepo = new ExecutionHistoryRepository(ctx.supabase, ctx.userId);
  await historyRepo.create({
    plan_id: plan.id,
    task_id: null,
    evento: "plano_gerado",
    modulo: "execution",
    detalhes: { titulo: generated.titulo, total: totalTasks },
    xp_ganho: 0,
  });

  return { plan: plan as ExecutionPlan, tasks: tasks ?? [], briefing: briefingData, error: null };
}

async function syncSourceModuleOnComplete(task: ExecutionTask): Promise<void> {
  const ref = task.source_ref;
  if (!ref) return;

  if (ref.startsWith("money-task:")) {
    const moneyTaskId = ref.replace("money-task:", "");
    await completeMoneyMissionTask(moneyTaskId);
  }
}

async function saveExecutiveMemory(task: ExecutionTask): Promise<void> {
  await saveAuraMemory({
    module: "execution",
    userMessage: `Tarefa concluída: ${task.titulo}`,
    assistantContent: `✅ Missão concluída no Execution Engine: **${task.titulo}**
Módulo: ${task.modulo_origem} · Área: ${task.area}
Impacto: ${task.impacto} · ROI: ${task.roi}% · Energia: ${task.energia}/5`,
    metadata: {
      kind: "execution",
      area: task.area,
      modulo: task.modulo_origem,
      taskId: task.id,
    },
  });
}

export async function completeExecutionTask(taskId: string): Promise<{
  task: ExecutionTask | null;
  xpAwarded: number;
  planComplete: boolean;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { task: null, xpAwarded: 0, planComplete: false, error: "Usuário não autenticado." };

  const tasksRepo = new ExecutionTasksRepository(ctx.supabase, ctx.userId);
  const plansRepo = new ExecutionPlansRepository(ctx.supabase, ctx.userId);
  const historyRepo = new ExecutionHistoryRepository(ctx.supabase, ctx.userId);

  const { data: existing } = await tasksRepo.findById(taskId);
  if (!existing || existing.status === "completed") {
    return { task: null, xpAwarded: 0, planComplete: false, error: "Tarefa não encontrada ou já concluída." };
  }

  const { data: task, error: updateError } = await tasksRepo.update(taskId, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  if (updateError || !task) {
    return { task: null, xpAwarded: 0, planComplete: false, error: updateError ?? "Erro ao concluir." };
  }

  const completedTask = task as ExecutionTask;

  await syncSourceModuleOnComplete(completedTask);

  const xpResult = await awardAuraXp(
    "missao_execution_concluir",
    `execution-task:${taskId}`
  );
  const xpAwarded = xpResult.awarded ? xpResult.xp : 0;

  await historyRepo.create({
    plan_id: completedTask.plan_id,
    task_id: taskId,
    evento: "tarefa_concluida",
    modulo: completedTask.modulo_origem,
    detalhes: {
      titulo: completedTask.titulo,
      area: completedTask.area,
      impacto: completedTask.impacto,
      roi: completedTask.roi,
    },
    xp_ganho: xpAwarded,
  });

  await saveExecutiveMemory(completedTask);

  const { data: allTasks } = await tasksRepo.findByPlanId(completedTask.plan_id);
  const completed = (allTasks ?? []).filter((t) => t.status === "completed").length;
  const total = (allTasks ?? []).length;
  const planComplete = completed >= total && total > 0;

  const planUpdate: Partial<TableInsert<"execution_plans">> = {
    missoes_concluidas: completed,
    missoes_total: total,
    status: planComplete ? "completed" : "active",
  };

  if (planComplete) {
    await awardAuraXp("execution_plano_completo", `execution-plan:${completedTask.plan_id}`);
    await historyRepo.create({
      plan_id: completedTask.plan_id,
      task_id: null,
      evento: "plano_completo",
      modulo: "execution",
      detalhes: { total, completed },
      xp_ganho: xpResult.awarded ? 0 : 0,
    });
  }

  await plansRepo.update(completedTask.plan_id, planUpdate);

  return { task: completedTask, xpAwarded, planComplete, error: null };
}

const OPERATION_MISSION_STEPS: {
  stepId: OperationStepId;
  taskKey: string;
  titulo: string;
  descricao: string;
}[] = [
  {
    stepId: "criativos",
    taskKey: "criativos",
    titulo: "Gerar criativos da operação",
    descricao: "Gerar criativos no Operation Center para a operação ativa.",
  },
  {
    stepId: "landing",
    taskKey: "landing",
    titulo: "Gerar landing da operação",
    descricao: "Gerar landing page no Operation Center para a operação ativa.",
  },
  {
    stepId: "meta_ads",
    taskKey: "campanha",
    titulo: "Montar campanha da operação",
    descricao: "Montar campanha em rascunho no Operation Center (modo seguro — sem publicação automática).",
  },
  {
    stepId: "performance_ai",
    taskKey: "performance",
    titulo: "Enviar operação para Performance AI",
    descricao: "Gerar relatório Performance AI com contexto da operação ativa.",
  },
  {
    stepId: "aprovacao",
    taskKey: "aprovar",
    titulo: "Aprovar operação",
    descricao: "Aprovar operação no Operation Center (modo seguro — status Pronta, sem publicar anúncios).",
  },
];

async function ensureTodayExecutionPlan(
  plansRepo: ExecutionPlansRepository,
  displayName: string
): Promise<{ plan: ExecutionPlan | null; error: string | null }> {
  const today = todayIsoDate();
  const existing = await plansRepo.findByDate(today);
  if (existing.data) return { plan: existing.data, error: null };

  const { data: plan, error } = await plansRepo.create({
    plan_date: today,
    titulo: "Missões Operation Center",
    status: "active",
    briefing: {
      greeting: buildGreeting(displayName),
      display_name: displayName,
      projeto_prioritario: "Operation Center",
      meta_financeira: "Concluir operação ativa",
      probabilidade_atual: 0,
      conselho_ceo: "Priorize as etapas pendentes da operação ativa.",
    },
    score_execucao: 0,
    missoes_concluidas: 0,
    missoes_total: 0,
    resumo: "Missões automáticas sincronizadas pelo Operation Center.",
  } satisfies Omit<TableInsert<"execution_plans">, "user_id">);

  return { plan: (plan as ExecutionPlan | null) ?? null, error: error ?? null };
}

export async function syncOperationCenterTasks(
  dashboard: OperationCenterDashboard
): Promise<void> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return;

  const operation = dashboard.operation;
  if (!operation) return;

  const plansRepo = new ExecutionPlansRepository(ctx.supabase, ctx.userId);
  const tasksRepo = new ExecutionTasksRepository(ctx.supabase, ctx.userId);
  const sourcePrefix = `operation-center:${operation.id}:`;

  if (
    operation.status === "cancelled" ||
    operation.status === "ready" ||
    operation.status === "approved"
  ) {
    await tasksRepo.deleteBySourceRefPrefix(sourcePrefix);
    return;
  }

  const displayName = await resolveUserDisplayName(ctx);
  const { plan, error: planError } = await ensureTodayExecutionPlan(plansRepo, displayName);
  if (planError || !plan) return;

  await tasksRepo.deleteBySourceRefPrefix(sourcePrefix);

  const steps = Object.fromEntries(dashboard.progress.map((item) => [item.id, item.status])) as Record<
    OperationStepId,
    "pending" | "in_progress" | "done"
  >;

  const pendingMissionSteps = OPERATION_MISSION_STEPS.filter(
    (mission) => steps[mission.stepId] !== "done"
  );
  if (pendingMissionSteps.length === 0) return;

  const { data: existingTasks } = await tasksRepo.findByPlanId(plan.id);
  let ordem = (existingTasks ?? []).reduce((max, task) => Math.max(max, task.ordem), -1) + 1;
  const today = todayIsoDate();
  const roi = dashboard.successChance ?? dashboard.operationalScore;

  const payloads: Omit<TableInsert<"execution_tasks">, "user_id">[] = pendingMissionSteps.map(
    (mission, index) => ({
      plan_id: plan.id,
      task_key: `operation-${operation.id}-${mission.taskKey}`,
      titulo: mission.titulo,
      descricao: mission.descricao,
      categoria: "diaria",
      area: "marketing",
      modulo_origem: "operation-center",
      prioridade: Math.max(50, 95 - index * 8),
      impacto: Math.min(100, dashboard.operationalScore + 10),
      urgencia: Math.max(40, 90 - index * 5),
      roi,
      energia: 3,
      href: "/dashboard/operation-center",
      source_ref: `${sourcePrefix}${mission.taskKey}`,
      status: "pending",
      task_date: today,
      ordem: ordem++,
      xp_reward: 20,
    })
  );

  await tasksRepo.createMany(payloads);

  const { data: allTasks } = await tasksRepo.findByPlanId(plan.id);
  const completed = (allTasks ?? []).filter((task) => task.status === "completed").length;
  await plansRepo.update(plan.id, {
    missoes_total: allTasks?.length ?? 0,
    missoes_concluidas: completed,
  });
}

export async function deleteExecutionPlan(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const repo = new ExecutionPlansRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
