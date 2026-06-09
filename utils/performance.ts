import type {
  Conteudo,
  CreatorAdsCampaign,
  CreatorLaunchPlan,
  ExecutionPlan,
  ExecutionTask,
  FinancialGoal,
  FinancialIncome,
  Gasto,
  MoneyMissionPlan,
  PerformanceInsight,
  PerformanceReport,
} from "@/types/database";
import type { AuraXpState } from "@/lib/supabase/services/xp.service";
import type { CeoDashboardMetrics, CeoOpportunityRadar } from "@/utils/ceo";
import type { AdsDashboardMetrics } from "@/utils/ads-manager";
import type { CreatorDashboardMetrics } from "@/utils/creator";
import type { ExecutionDashboardMetrics } from "@/utils/execution";
import type { LaunchDashboardMetrics } from "@/utils/launch";
import type { MoneyDashboardMetrics } from "@/utils/money";
import {
  computeSmartFinanceStats,
  filterIncomeCurrentMonth,
  getActiveFinancialGoal,
} from "@/utils/finance";
import { formatBRL } from "@/utils/format";
import { getConteudoPublishedDate, normalizeConteudoStatus } from "@/utils/social";
import { getWeekRange } from "@/utils/executive-reports";

export type PerformancePeriod = "daily" | "weekly" | "monthly";

export type PerformanceDashboardMetrics = {
  receita: number;
  receitaFormatted: string;
  metaAtingidaPct: number;
  metaAtingidaFormatted: string;
  projetosAtivos: number;
  taxaExecucao: number;
  taxaExecucaoFormatted: string;
  xpTotal: number;
  xpNivel: number;
  conteudosPublicados: number;
  lancamentos: number;
  roiEstimado: number;
  roiEstimadoFormatted: string;
  scorePerformance: number;
  relatorioAtivo: boolean;
};

export type PerformancePanel = {
  maiorOportunidade: string;
  maiorRisco: string;
  maiorDesperdicio: string;
  melhorProjeto: string;
  conselhoCeo: string;
};

export type PerformanceAiAnalysis = {
  oQueFunciona: string;
  oQueAtrasa: string;
  projetoAcelerar: string;
  projetoAbandonar: string;
  maiorPotencial: string;
};

export type PerformanceExecutiveMemory = {
  campanhasBoas: string[];
  produtosBons: string[];
  habitosProdutivos: string[];
  errosRecorrentes: string[];
};

export type GeneratedPerformanceReport = {
  titulo: string;
  resumo: string;
  score_performance: number;
  ai_analysis: PerformanceAiAnalysis;
  panel: PerformancePanel;
  executive_memory: PerformanceExecutiveMemory;
  insights: {
    tipo: PerformanceInsight["tipo"];
    titulo: string;
    descricao: string;
    score: number;
    modulo?: string;
  }[];
};

export type PerformanceInputData = {
  gastos: Gasto[];
  financialIncome: FinancialIncome[];
  financialGoals: FinancialGoal[];
  initialBalance?: number | null;
  moneyPlan: MoneyMissionPlan | null;
  moneyDashboard: MoneyDashboardMetrics;
  creatorDashboard: CreatorDashboardMetrics;
  launchDashboard: LaunchDashboardMetrics;
  adsDashboard: AdsDashboardMetrics;
  executionPlan: ExecutionPlan | null;
  executionTasks: ExecutionTask[];
  executionDashboard: ExecutionDashboardMetrics;
  ceoDashboard: CeoDashboardMetrics;
  ceoRadar: CeoOpportunityRadar | null;
  conteudos: Conteudo[];
  launchPlans: CreatorLaunchPlan[];
  adsCampaigns: CreatorAdsCampaign[];
  auraXp: AuraXpState | null;
};

export const PERFORMANCE_AI_CONTEXT = `Você é a Aura Performance AI — analisa resultados de todos os módulos da Aura e toma decisões estratégicas.
Leia Financeiro, Money Missions, Social Media, Creator, Launch Center, Ads Manager, Execution Engine e Aura CEO.
Responda com clareza executiva, orientada a ação, em português do Brasil.`;

export const PERFORMANCE_IA_ACTIONS = [
  {
    id: "o-que-funciona",
    label: "O que funciona?",
    prompt: "O que está funcionando?",
  },
  {
    id: "o-que-atrasa",
    label: "O que atrasa?",
    prompt: "O que está me atrasando?",
  },
  {
    id: "acelerar",
    label: "Acelerar projeto",
    prompt: "Qual projeto devo acelerar?",
  },
  {
    id: "abandonar",
    label: "Abandonar projeto",
    prompt: "Qual projeto devo abandonar?",
  },
  {
    id: "potencial",
    label: "Maior potencial",
    prompt: "Qual oportunidade tem maior potencial?",
  },
] as const;

const PERFORMANCE_WEEK_PHRASES = [
  "como foi minha semana",
  "como foi a semana",
  "resultado da semana",
] as const;

const PERFORMANCE_MONEY_LOSS_PHRASES = [
  "onde estou perdendo dinheiro",
  "onde perco dinheiro",
  "estou perdendo dinheiro",
  "vazamento de dinheiro",
] as const;

const PERFORMANCE_OPTIMIZE_PHRASES = [
  "o que devo otimizar",
  "o que otimizar",
  "onde otimizar",
  "como otimizar",
] as const;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesAny(normalized: string, phrases: readonly string[]): boolean {
  return phrases.some((p) => normalized.includes(normalize(p)));
}

export type PerformanceCoachMode =
  | "performance-week"
  | "performance-money-loss"
  | "performance-optimize";

export function detectPerformanceCoachMode(message: string): PerformanceCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, PERFORMANCE_WEEK_PHRASES)) return "performance-week";
  if (matchesAny(normalized, PERFORMANCE_MONEY_LOSS_PHRASES)) return "performance-money-loss";
  if (matchesAny(normalized, PERFORMANCE_OPTIMIZE_PHRASES)) return "performance-optimize";
  return null;
}

export function parsePerformancePanel(json: unknown): PerformancePanel | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as PerformancePanel;
  if (!obj.maiorOportunidade && !obj.conselhoCeo) return null;
  return obj;
}

export function parsePerformanceAiAnalysis(json: unknown): PerformanceAiAnalysis | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as PerformanceAiAnalysis;
  if (!obj.oQueFunciona && !obj.maiorPotencial) return null;
  return obj;
}

export function parsePerformanceExecutiveMemory(json: unknown): PerformanceExecutiveMemory {
  const empty: PerformanceExecutiveMemory = {
    campanhasBoas: [],
    produtosBons: [],
    habitosProdutivos: [],
    errosRecorrentes: [],
  };
  if (!json || typeof json !== "object") return empty;
  const obj = json as Partial<PerformanceExecutiveMemory>;
  return {
    campanhasBoas: Array.isArray(obj.campanhasBoas) ? obj.campanhasBoas : [],
    produtosBons: Array.isArray(obj.produtosBons) ? obj.produtosBons : [],
    habitosProdutivos: Array.isArray(obj.habitosProdutivos) ? obj.habitosProdutivos : [],
    errosRecorrentes: Array.isArray(obj.errosRecorrentes) ? obj.errosRecorrentes : [],
  };
}

export function computePerformanceDashboard(
  input: PerformanceInputData,
  report: PerformanceReport | null
): PerformanceDashboardMetrics {
  const financeStats = computeSmartFinanceStats({
    gastos: input.gastos,
    income: input.financialIncome,
    goals: input.financialGoals,
    initialBalance: input.initialBalance,
  });

  const receita = filterIncomeCurrentMonth(input.financialIncome).reduce(
    (sum, row) => sum + Number(row.valor),
    0
  );

  let metaAtingidaPct = 0;
  if (input.moneyDashboard.planoAtivo) {
    metaAtingidaPct = input.moneyDashboard.progressoPct;
  } else {
    const goal = getActiveFinancialGoal(input.financialGoals);
    if (goal) {
      metaAtingidaPct = financeStats.goalProgress?.pct ?? 0;
    }
  }

  const projetosAtivos =
    input.creatorDashboard.produtosCriados +
    input.launchDashboard.planosAtivos +
    (input.moneyDashboard.planoAtivo ? 1 : 0);

  const taxaExecucao =
    input.executionDashboard.missoesTotal > 0
      ? Math.round(
          (input.executionDashboard.missoesConcluidas /
            input.executionDashboard.missoesTotal) *
            100
        )
      : input.executionDashboard.scoreExecucao;

  const { start, end } = getWeekRange();
  const conteudosPublicados = input.conteudos.filter((c) => {
    if (normalizeConteudoStatus(c.status) !== "publicado") return false;
    const published = getConteudoPublishedDate(c);
    return published >= start && published <= end;
  }).length;

  const lancamentos =
    input.launchPlans.filter((p) => p.estagio_atual === "lancado").length ||
    input.launchDashboard.planosAtivos;

  const rois = [
    input.moneyPlan?.roi_estimado,
    input.creatorDashboard.roiMedio,
    ...input.adsCampaigns
      .map((c) => c.investimento_mensal_previsto)
      .filter((v): v is number => v != null && v > 0),
  ].filter((v): v is number => v != null && !Number.isNaN(v));

  const roiEstimado =
    rois.length > 0 ? Math.round(rois.reduce((a, b) => a + Number(b), 0) / rois.length) : 0;

  return {
    receita,
    receitaFormatted: formatBRL(receita),
    metaAtingidaPct,
    metaAtingidaFormatted: `${metaAtingidaPct}%`,
    projetosAtivos,
    taxaExecucao,
    taxaExecucaoFormatted: `${taxaExecucao}%`,
    xpTotal: input.auraXp?.userXp.xp_total ?? input.ceoDashboard.xpAtual,
    xpNivel: input.auraXp?.userXp.nivel ?? input.ceoDashboard.xpNivel,
    conteudosPublicados,
    lancamentos,
    roiEstimado,
    roiEstimadoFormatted: `${roiEstimado}%`,
    scorePerformance: report?.score_performance ?? taxaExecucao,
    relatorioAtivo: !!report && report.status === "active",
  };
}

export function buildPerformanceFallbackPanel(
  input: PerformanceInputData
): PerformancePanel {
  const radar = input.ceoRadar;
  return {
    maiorOportunidade:
      radar?.melhorOportunidade.titulo ??
      input.creatorDashboard.melhorOportunidade ??
      "Revise Money Missions e Creator para identificar oportunidades.",
    maiorRisco:
      input.moneyDashboard.diasRestantes <= 7 && input.moneyDashboard.progressoPct < 50
        ? `Meta financeira com ${input.moneyDashboard.diasRestantes} dias e ${input.moneyDashboard.progressoPct}% concluído`
        : input.executionDashboard.missoesDiariasPendentes > 3
          ? `${input.executionDashboard.missoesDiariasPendentes} missões diárias pendentes`
          : "Execução abaixo do ritmo esperado",
    maiorDesperdicio:
      input.adsDashboard.emRascunho > 2
        ? `${input.adsDashboard.emRascunho} campanhas em rascunho sem ativação`
        : input.conteudos.filter((c) => normalizeConteudoStatus(c.status) !== "publicado")
              .length > 3
          ? "Conteúdos parados sem publicação"
          : "Tempo em projetos sem validação",
    melhorProjeto:
      input.launchDashboard.produtoAtual !== "—"
        ? input.launchDashboard.produtoAtual
        : input.creatorDashboard.melhorOportunidade ?? input.ceoDashboard.projetoPrincipal,
    conselhoCeo:
      input.ceoDashboard.missaoDoDia ||
      "Foque no projeto com maior ROI e conclua as missões do Execution Engine hoje.",
  };
}

export function buildPerformanceFallbackAnalysis(
  input: PerformanceInputData,
  panel: PerformancePanel
): PerformanceAiAnalysis {
  return {
    oQueFunciona:
      input.executionDashboard.missoesConcluidas > 0
        ? `Execução: ${input.executionDashboard.missoesConcluidas} missões concluídas`
        : "Módulos com dados ativos — gere um relatório completo para detalhar.",
    oQueAtrasa: panel.maiorRisco,
    projetoAcelerar: panel.melhorProjeto,
    projetoAbandonar:
      input.creatorDashboard.produtosCriados > 3
        ? "Produtos Creator sem checklist ou validação há mais de 30 dias"
        : "Nenhum projeto crítico para abandonar agora",
    maiorPotencial: panel.maiorOportunidade,
  };
}

export function buildPerformanceAuraContext(
  dashboard: PerformanceDashboardMetrics,
  panel: PerformancePanel | null,
  analysis: PerformanceAiAnalysis | null
): string {
  const lines = [
    "## AURA PERFORMANCE AI",
    `Receita: ${dashboard.receitaFormatted}`,
    `Meta atingida: ${dashboard.metaAtingidaFormatted}`,
    `Projetos ativos: ${dashboard.projetosAtivos}`,
    `Taxa de execução: ${dashboard.taxaExecucaoFormatted}`,
    `XP: ${dashboard.xpTotal} (nível ${dashboard.xpNivel})`,
    `Conteúdos publicados (semana): ${dashboard.conteudosPublicados}`,
    `Lançamentos: ${dashboard.lancamentos}`,
    `ROI estimado: ${dashboard.roiEstimadoFormatted}`,
    `Score performance: ${dashboard.scorePerformance}`,
  ];

  if (panel) {
    lines.push(
      "",
      "### Painel estratégico",
      `Maior oportunidade: ${panel.maiorOportunidade}`,
      `Maior risco: ${panel.maiorRisco}`,
      `Maior desperdício: ${panel.maiorDesperdicio}`,
      `Melhor projeto: ${panel.melhorProjeto}`,
      `Conselho CEO: ${panel.conselhoCeo}`
    );
  }

  if (analysis) {
    lines.push(
      "",
      "### Análise IA",
      `Funcionando: ${analysis.oQueFunciona}`,
      `Atrasando: ${analysis.oQueAtrasa}`,
      `Acelerar: ${analysis.projetoAcelerar}`,
      `Abandonar: ${analysis.projetoAbandonar}`,
      `Maior potencial: ${analysis.maiorPotencial}`
    );
  }

  return lines.join("\n");
}

export function buildPerformanceCoachReply({
  mode,
  displayName,
  dashboard,
  panel,
  analysis,
}: {
  mode: PerformanceCoachMode;
  displayName: string;
  dashboard: PerformanceDashboardMetrics;
  panel: PerformancePanel;
  analysis: PerformanceAiAnalysis;
}): string {
  switch (mode) {
    case "performance-week":
      return `${displayName}, panorama da sua semana:

📊 **Métricas**
• Receita: ${dashboard.receitaFormatted}
• Meta: ${dashboard.metaAtingidaFormatted}
• Execução: ${dashboard.taxaExecucaoFormatted}
• Conteúdos publicados: ${dashboard.conteudosPublicados}
• XP: ${dashboard.xpTotal} (nível ${dashboard.xpNivel})

✅ **Funcionando:** ${analysis.oQueFunciona}

⚠️ **Atrasando:** ${analysis.oQueAtrasa}

🎯 **Próximo passo:** ${panel.conselhoCeo}`;

    case "performance-money-loss":
      return `${displayName}, onde você pode estar perdendo dinheiro:

💸 **Desperdício principal:** ${panel.maiorDesperdicio}

📉 **Risco:** ${panel.maiorRisco}

💡 **Otimizar:** ${analysis.projetoAbandonar === "Nenhum projeto crítico para abandonar agora" ? panel.maiorOportunidade : `Corte foco em ${analysis.projetoAbandonar} e acelere ${analysis.projetoAcelerar}`}

Receita do mês: ${dashboard.receitaFormatted} · ROI estimado: ${dashboard.roiEstimadoFormatted}`;

    case "performance-optimize":
      return `${displayName}, o que otimizar agora:

1. **Acelerar:** ${analysis.projetoAcelerar}
2. **Maior potencial:** ${analysis.maiorPotencial}
3. **Cortar:** ${analysis.projetoAbandonar}

Taxa de execução: ${dashboard.taxaExecucaoFormatted} · Projetos ativos: ${dashboard.projetosAtivos}

${panel.conselhoCeo}`;

    default:
      return panel.conselhoCeo;
  }
}
