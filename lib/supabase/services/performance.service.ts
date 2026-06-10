import OpenAI from "openai";
import { saveAuraMemory } from "@/lib/supabase/services/ai-memories.service";
import { getAdsDashboard } from "@/lib/supabase/services/ads-manager.service";
import { getCeoDashboard } from "@/lib/supabase/services/ceo.service";
import { getCreatorDashboard } from "@/lib/supabase/services/creator.service";
import { getExecutionDashboard } from "@/lib/supabase/services/execution.service";
import { getLaunchDashboard } from "@/lib/supabase/services/launch.service";
import { getMoneyDashboard } from "@/lib/supabase/services/money.service";
import { loadExecutiveReportData } from "@/lib/supabase/services/reports.service";
import { awardAuraXp } from "@/lib/supabase/services/xp.service";
import { PerformanceInsightsRepository } from "@/lib/supabase/repositories/performance-insights.repository";
import { PerformanceMetricsRepository } from "@/lib/supabase/repositories/performance-metrics.repository";
import { PerformanceReportsRepository } from "@/lib/supabase/repositories/performance-reports.repository";
import type {
  PerformanceInsight,
  PerformanceMetric,
  PerformanceReport,
  TableInsert,
  Json,
} from "@/types/database";
import type { CeoDashboardMetrics } from "@/utils/ceo";
import type { AdsDashboardMetrics } from "@/utils/ads-manager";
import type { CreatorDashboardMetrics } from "@/utils/creator";
import type { ExecutionDashboardMetrics } from "@/utils/execution";
import type { LaunchDashboardMetrics } from "@/utils/launch";
import { computeMoneyDashboard } from "@/utils/money";
import {
  buildPerformanceAuraContext,
  buildPerformanceFallbackAnalysis,
  buildPerformanceFallbackPanel,
  computePerformanceDashboard,
  type GeneratedPerformanceReport,
  type PerformanceAiAnalysis,
  type PerformanceDashboardMetrics,
  type PerformanceExecutiveMemory,
  type PerformanceInputData,
  type PerformancePanel,
  parsePerformanceAiAnalysis,
  parsePerformanceExecutiveMemory,
  parsePerformancePanel,
} from "@/utils/performance";
import { todayIsoDate } from "@/utils/health";
import { getOptionalDataContext } from "./context";
import { buildBudgetContextBlock, getResolvedUserBudget } from "./campaign-budget.service";
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

async function callPerformanceAi<T>(system: string, user: string): Promise<T | null> {
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

const SYSTEM_PROMPT = `Você é a Aura Performance AI — analisa resultados cross-module e toma decisões estratégicas.
Responda APENAS JSON:
{
  "titulo": string,
  "resumo": string,
  "score_performance": number,
  "ai_analysis": {
    "oQueFunciona": string,
    "oQueAtrasa": string,
    "projetoAcelerar": string,
    "projetoAbandonar": string,
    "maiorPotencial": string
  },
  "panel": {
    "maiorOportunidade": string,
    "maiorRisco": string,
    "maiorDesperdicio": string,
    "melhorProjeto": string,
    "conselhoCeo": string
  },
  "executive_memory": {
    "campanhasBoas": string[],
    "produtosBons": string[],
    "habitosProdutivos": string[],
    "errosRecorrentes": string[]
  },
  "insights": [
    {
      "tipo": "oportunidade" | "risco" | "desperdicio" | "projeto" | "funcionando" | "atrasando" | "acelerar" | "abandonar" | "potencial",
      "titulo": string,
      "descricao": string,
      "score": number,
      "modulo": string
    }
  ]
}
Regras:
- score_performance: 0-100 baseado em execução, metas e ROI
- insights: 6-10 itens cobrindo painel e análise
- executive_memory: aprenda padrões de campanhas, produtos, hábitos e erros
- Nunca assuma R$ 2.000 ou orçamento padrão — use apenas o orçamento informado pelo usuário
- Português do Brasil, tom executivo`;

const DEFAULT_CEO_DASHBOARD: CeoDashboardMetrics = {
  metaFinanceiraAtiva: "—",
  projetoPrincipal: "—",
  missaoDoDia: "—",
  xpAtual: 0,
  xpNivel: 1,
  valorConquistado: 0,
  proximoMarco: "—",
};

const DEFAULT_CREATOR: CreatorDashboardMetrics = {
  produtosCriados: 0,
  produtosValidados: 0,
  melhorOportunidade: "—",
  potencialEstimado: 0,
  roiMedio: 0,
  emProducao: 0,
};

const DEFAULT_LAUNCH: LaunchDashboardMetrics = {
  produtoAtual: "—",
  estagio: "—",
  scoreIa: 0,
  receitaEstimada: 0,
  dataPrevista: "—",
  checklistPercent: 0,
  planosAtivos: 0,
};

const DEFAULT_ADS: AdsDashboardMetrics = {
  totalCampanhas: 0,
  ultimoProduto: "—",
  emRascunho: 0,
  comCriativos: 0,
  comLanding: 0,
};

const DEFAULT_EXECUTION: ExecutionDashboardMetrics = {
  scoreExecucao: 0,
  missoesConcluidas: 0,
  missoesTotal: 0,
  missoesDiariasPendentes: 0,
  missoesSemanaisPendentes: 0,
  xpGanhoHoje: 0,
  planoAtivo: false,
};

export async function loadPerformanceInputData(): Promise<{
  input: PerformanceInputData | null;
  error: string | null;
}> {
  const [
    execReport,
    money,
    ceo,
    creator,
    launch,
    ads,
    execution,
  ] = await Promise.all([
    loadExecutiveReportData(),
    getMoneyDashboard(),
    getCeoDashboard(),
    getCreatorDashboard(),
    getLaunchDashboard(),
    getAdsDashboard(),
    getExecutionDashboard(),
  ]);

  if (execReport.error || !execReport.data) {
    return { input: null, error: execReport.error ?? "Erro ao carregar dados." };
  }

  const data = execReport.data;
  const moneyDashboard = computeMoneyDashboard(money.plan, money.tasks);

  const input: PerformanceInputData = {
    gastos: data.gastos,
    financialIncome: data.financialIncome,
    financialGoals: data.financialGoals,
    initialBalance: data.financialBalance?.valor_atual,
    moneyPlan: money.plan,
    moneyDashboard,
    creatorDashboard: creator.dashboard ?? DEFAULT_CREATOR,
    launchDashboard: launch.dashboard ?? DEFAULT_LAUNCH,
    adsDashboard: ads.dashboard ?? DEFAULT_ADS,
    executionPlan: execution.plan,
    executionTasks: execution.tasks,
    executionDashboard: execution.dashboard ?? DEFAULT_EXECUTION,
    ceoDashboard: ceo.dashboard ?? DEFAULT_CEO_DASHBOARD,
    ceoRadar: ceo.radar,
    conteudos: data.conteudos,
    launchPlans: launch.plans,
    adsCampaigns: ads.records,
    auraXp: data.auraXp,
  };

  return { input, error: null };
}

async function loadPerformanceState(): Promise<{
  report: PerformanceReport | null;
  metrics: PerformanceMetric[];
  insights: PerformanceInsight[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { report: null, metrics: [], insights: [], error: "Usuário não autenticado." };
  }

  const reportsRepo = new PerformanceReportsRepository(ctx.supabase, ctx.userId);
  const metricsRepo = new PerformanceMetricsRepository(ctx.supabase, ctx.userId);
  const insightsRepo = new PerformanceInsightsRepository(ctx.supabase, ctx.userId);

  const { data: report, error: reportError } = await reportsRepo.findLatestActive();
  if (reportError) {
    return { report: null, metrics: [], insights: [], error: reportError };
  }

  if (!report) {
    return { report: null, metrics: [], insights: [], error: null };
  }

  const [{ data: metrics }, { data: insights }] = await Promise.all([
    metricsRepo.findByReportId(report.id),
    insightsRepo.findByReportId(report.id),
  ]);

  return {
    report,
    metrics: metrics ?? [],
    insights: insights ?? [],
    error: null,
  };
}

function buildMetricsRows(
  reportId: string,
  dashboard: PerformanceDashboardMetrics
): Omit<TableInsert<"performance_metrics">, "user_id">[] {
  return [
    {
      report_id: reportId,
      metric_key: "receita",
      metric_label: "Receita",
      metric_value: dashboard.receita,
      metric_formatted: dashboard.receitaFormatted,
      modulo: "financeiro",
    },
    {
      report_id: reportId,
      metric_key: "meta_atingida",
      metric_label: "Meta atingida",
      metric_value: dashboard.metaAtingidaPct,
      metric_formatted: dashboard.metaAtingidaFormatted,
      modulo: "money",
    },
    {
      report_id: reportId,
      metric_key: "projetos_ativos",
      metric_label: "Projetos ativos",
      metric_value: dashboard.projetosAtivos,
      metric_formatted: String(dashboard.projetosAtivos),
      modulo: "creator",
    },
    {
      report_id: reportId,
      metric_key: "taxa_execucao",
      metric_label: "Taxa de execução",
      metric_value: dashboard.taxaExecucao,
      metric_formatted: dashboard.taxaExecucaoFormatted,
      modulo: "execution",
    },
    {
      report_id: reportId,
      metric_key: "xp",
      metric_label: "XP",
      metric_value: dashboard.xpTotal,
      metric_formatted: `${dashboard.xpTotal} (nível ${dashboard.xpNivel})`,
      modulo: "crescimento",
    },
    {
      report_id: reportId,
      metric_key: "conteudos_publicados",
      metric_label: "Conteúdos publicados",
      metric_value: dashboard.conteudosPublicados,
      metric_formatted: String(dashboard.conteudosPublicados),
      modulo: "social",
    },
    {
      report_id: reportId,
      metric_key: "lancamentos",
      metric_label: "Lançamentos",
      metric_value: dashboard.lancamentos,
      metric_formatted: String(dashboard.lancamentos),
      modulo: "launch",
    },
    {
      report_id: reportId,
      metric_key: "roi_estimado",
      metric_label: "ROI estimado",
      metric_value: dashboard.roiEstimado,
      metric_formatted: dashboard.roiEstimadoFormatted,
      modulo: "ads",
    },
  ];
}

async function saveExecutiveMemoryReport(
  panel: PerformancePanel,
  memory: PerformanceExecutiveMemory
): Promise<void> {
  await saveAuraMemory({
    module: "performance",
    userMessage: "Relatório de performance gerado",
    assistantContent: `📊 Performance AI\n\nOportunidade: ${panel.maiorOportunidade}\nRisco: ${panel.maiorRisco}\nMelhor projeto: ${panel.melhorProjeto}\n\nMemória executiva:\n• Campanhas boas: ${memory.campanhasBoas.slice(0, 3).join("; ") || "—"}\n• Produtos bons: ${memory.produtosBons.slice(0, 3).join("; ") || "—"}\n• Hábitos: ${memory.habitosProdutivos.slice(0, 3).join("; ") || "—"}\n• Erros: ${memory.errosRecorrentes.slice(0, 3).join("; ") || "—"}`,
    metadata: { kind: "performance", area: "executive" },
  });
}

export async function getPerformanceDashboard(): Promise<{
  dashboard: PerformanceDashboardMetrics | null;
  report: PerformanceReport | null;
  metrics: PerformanceMetric[];
  insights: PerformanceInsight[];
  panel: PerformancePanel | null;
  analysis: PerformanceAiAnalysis | null;
  executiveMemory: PerformanceExecutiveMemory | null;
  error: string | null;
}> {
  const [{ input, error: inputError }, state] = await Promise.all([
    loadPerformanceInputData(),
    loadPerformanceState(),
  ]);

  if (inputError || !input) {
    return {
      dashboard: null,
      report: null,
      metrics: [],
      insights: [],
      panel: null,
      analysis: null,
      executiveMemory: null,
      error: inputError,
    };
  }

  if (state.error) {
    return {
      dashboard: null,
      report: null,
      metrics: [],
      insights: [],
      panel: null,
      analysis: null,
      executiveMemory: null,
      error: state.error,
    };
  }

  const dashboard = computePerformanceDashboard(input, state.report);
  let panel = state.report ? parsePerformancePanel(state.report.panel) : null;
  let analysis = state.report ? parsePerformanceAiAnalysis(state.report.ai_analysis) : null;
  const executiveMemory = state.report
    ? parsePerformanceExecutiveMemory(state.report.executive_memory)
    : null;

  if (!panel) {
    panel = buildPerformanceFallbackPanel(input);
  }
  if (!analysis) {
    analysis = buildPerformanceFallbackAnalysis(input, panel);
  }

  return {
    dashboard,
    report: state.report,
    metrics: state.metrics,
    insights: state.insights,
    panel,
    analysis,
    executiveMemory,
    error: null,
  };
}

export async function getPerformanceContext(): Promise<{ context: string; error: string | null }> {
  const [{ dashboard, panel, analysis, error }, { context: platformsContext }, { context: globalContext }, { context: knowledgeContext }] =
    await Promise.all([getPerformanceDashboard(), getPlatformsContext(), getGlobalContext(), getKnowledgeContext()]);
  if (error || !dashboard) {
    return { context: "", error: error ?? "Erro ao carregar Performance AI." };
  }

  const base = buildPerformanceAuraContext(dashboard, panel, analysis);
  const parts = [base, platformsContext, globalContext, knowledgeContext].filter(Boolean);
  return {
    context: parts.join("\n\n"),
    error: null,
  };
}

export async function generatePerformanceReport(): Promise<{
  report: PerformanceReport | null;
  dashboard: PerformanceDashboardMetrics | null;
  panel: PerformancePanel | null;
  analysis: PerformanceAiAnalysis | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { report: null, dashboard: null, panel: null, analysis: null, error: "Usuário não autenticado." };
  }

  const { input, error: inputError } = await loadPerformanceInputData();
  if (inputError || !input) {
    return { report: null, dashboard: null, panel: null, analysis: null, error: inputError };
  }

  const fallbackPanel = buildPerformanceFallbackPanel(input);
  const fallbackAnalysis = buildPerformanceFallbackAnalysis(input, fallbackPanel);
  const preDashboard = computePerformanceDashboard(input, null);

  let generated: GeneratedPerformanceReport | null = null;

  if (getOpenAi()) {
    const { budget } = await getResolvedUserBudget();
    const { context: platformsContext } = await getPlatformsContext();
    generated = await callPerformanceAi<GeneratedPerformanceReport>(
      `${SYSTEM_PROMPT}\n\n${buildBudgetContextBlock(budget.orcamento)}`,
      JSON.stringify({
        data: todayIsoDate(),
        orcamento_disponivel: budget.orcamento,
        metricas: preDashboard,
        modulos: {
          financeiro: { receita: preDashboard.receitaFormatted, meta: preDashboard.metaAtingidaFormatted },
          money: input.moneyDashboard,
          creator: input.creatorDashboard,
          launch: input.launchDashboard,
          ads: input.adsDashboard,
          execution: input.executionDashboard,
          ceo: input.ceoDashboard,
          social: { conteudosPublicados: preDashboard.conteudosPublicados },
          platforms: platformsContext || "Nenhuma plataforma conectada.",
        },
        fallback: { panel: fallbackPanel, analysis: fallbackAnalysis },
      })
    );
  }

  const panel = generated?.panel ?? fallbackPanel;
  const analysis = generated?.ai_analysis ?? fallbackAnalysis;
  const executiveMemory = generated?.executive_memory ?? {
    campanhasBoas: input.adsCampaigns.slice(0, 2).map((c) => c.nome ?? c.campanha_nome ?? "Campanha").filter(Boolean),
    produtosBons: [input.creatorDashboard.melhorOportunidade].filter((v) => v !== "—"),
    habitosProdutivos:
      input.executionDashboard.missoesConcluidas > 0
        ? ["Conclusão de missões Execution Engine"]
        : [],
    errosRecorrentes: [panel.maiorDesperdicio],
  };

  const score = generated?.score_performance ?? preDashboard.scorePerformance;
  const dashboard = { ...preDashboard, scorePerformance: score, relatorioAtivo: true };

  const reportsRepo = new PerformanceReportsRepository(ctx.supabase, ctx.userId);
  const metricsRepo = new PerformanceMetricsRepository(ctx.supabase, ctx.userId);
  const insightsRepo = new PerformanceInsightsRepository(ctx.supabase, ctx.userId);

  const { data: previous } = await reportsRepo.findLatestActive();
  if (previous) {
    await metricsRepo.deleteByReportId(previous.id);
    await insightsRepo.deleteByReportId(previous.id);
    await reportsRepo.update(previous.id, { status: "archived" });
  }

  const { data: report, error: insertError } = await reportsRepo.create({
    report_date: todayIsoDate(),
    period: "weekly",
    status: "active",
    titulo: generated?.titulo ?? "Análise de Performance",
    resumo: generated?.resumo ?? panel.conselhoCeo,
    score_performance: score,
    ai_analysis: analysis as unknown as Json,
    panel: panel as unknown as Json,
    executive_memory: executiveMemory as unknown as Json,
  });

  if (insertError || !report) {
    return {
      report: null,
      dashboard: null,
      panel: null,
      analysis: null,
      error: insertError ?? "Erro ao salvar relatório.",
    };
  }

  const metricRows = buildMetricsRows(report.id, dashboard);
  for (const row of metricRows) {
    await metricsRepo.create(row);
  }

  const insightRows =
    generated?.insights ??
    [
      { tipo: "oportunidade" as const, titulo: "Maior oportunidade", descricao: panel.maiorOportunidade, score: 90, modulo: "ceo" },
      { tipo: "risco" as const, titulo: "Maior risco", descricao: panel.maiorRisco, score: 85, modulo: "execution" },
      { tipo: "desperdicio" as const, titulo: "Maior desperdício", descricao: panel.maiorDesperdicio, score: 80, modulo: "ads" },
      { tipo: "projeto" as const, titulo: "Melhor projeto", descricao: panel.melhorProjeto, score: 88, modulo: "creator" },
      { tipo: "funcionando" as const, titulo: "Funcionando", descricao: analysis.oQueFunciona, score: 75, modulo: "execution" },
      { tipo: "atrasando" as const, titulo: "Atrasando", descricao: analysis.oQueAtrasa, score: 70, modulo: "money" },
      { tipo: "acelerar" as const, titulo: "Acelerar", descricao: analysis.projetoAcelerar, score: 82, modulo: "launch" },
      { tipo: "abandonar" as const, titulo: "Abandonar", descricao: analysis.projetoAbandonar, score: 60, modulo: "creator" },
      { tipo: "potencial" as const, titulo: "Maior potencial", descricao: analysis.maiorPotencial, score: 92, modulo: "ceo" },
    ];

  for (const insight of insightRows) {
    await insightsRepo.create({
      report_id: report.id,
      tipo: insight.tipo,
      titulo: insight.titulo,
      descricao: insight.descricao,
      score: insight.score,
      modulo: insight.modulo ?? null,
    });
  }

  await awardAuraXp("performance_analise_gerar", `performance-report:${report.id}`);
  await saveExecutiveMemoryReport(panel, executiveMemory);

  return { report, dashboard, panel, analysis, error: null };
}

export async function deletePerformanceReport(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { error: "Usuário não autenticado." };

  const metricsRepo = new PerformanceMetricsRepository(ctx.supabase, ctx.userId);
  const insightsRepo = new PerformanceInsightsRepository(ctx.supabase, ctx.userId);
  const reportsRepo = new PerformanceReportsRepository(ctx.supabase, ctx.userId);

  await metricsRepo.deleteByReportId(id);
  await insightsRepo.deleteByReportId(id);
  const { error } = await reportsRepo.delete(id);
  return { error };
}
