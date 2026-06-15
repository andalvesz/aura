import type {
  ExecutionHistoryEntry,
  ExecutionPlan,
  ExecutionTask,
  ExecutionTaskArea,
  ExecutionTaskModulo,
} from "@/types/database";
import { formatBRL } from "@/utils/format";

export type DailyBriefing = {
  greeting: string;
  display_name: string;
  projeto_prioritario: string;
  meta_financeira: string;
  probabilidade_atual: number;
  conselho_ceo: string;
};

export type GeneratedExecutionTask = {
  task_key: string;
  titulo: string;
  descricao: string;
  categoria: "diaria" | "semanal";
  area: ExecutionTaskArea;
  modulo_origem: ExecutionTaskModulo;
  prioridade: number;
  impacto: number;
  urgencia: number;
  roi: number;
  energia: number;
  href?: string;
  source_ref?: string;
  semana?: number;
};

export type GeneratedDailyPlan = {
  titulo: string;
  resumo: string;
  score_execucao: number;
  briefing: {
    projeto_prioritario: string;
    meta_financeira: string;
    probabilidade_atual: number;
    conselho_ceo: string;
  };
  missoes_diarias: GeneratedExecutionTask[];
  missoes_semanais: GeneratedExecutionTask[];
};

export type ExecutionDashboardMetrics = {
  scoreExecucao: number;
  missoesConcluidas: number;
  missoesTotal: number;
  missoesDiariasPendentes: number;
  missoesSemanaisPendentes: number;
  xpGanhoHoje: number;
  planoAtivo: boolean;
};

export const EXECUTION_AREAS: { id: ExecutionTaskArea; label: string }[] = [
  { id: "marketing", label: "Marketing" },
  { id: "negocios", label: "Negócios" },
  { id: "saude", label: "Saúde" },
  { id: "desenvolvimento", label: "Desenvolvimento" },
  { id: "relacionamentos", label: "Relacionamentos" },
];

export const EXECUTION_MODULO_LABELS: Record<ExecutionTaskModulo, string> = {
  ceo: "Aura CEO",
  money: "Money Missions",
  orchestrator: "Campaign Orchestrator",
  launch: "Launch Center",
  creator: "Creator",
  social: "Social Media",
  alvesz: "Alvesz",
  financeiro: "Financeiro",
  calendario: "Calendário",
  saude: "Saúde",
  idiomas: "Idiomas",
  "operation-center": "Operation Center",
};

export const EXECUTION_AI_CONTEXT = `Você é a Aura Execution Engine — transforma planos de todos os módulos da Aura em tarefas executáveis.
Calcule prioridade, impacto, urgência, ROI e energia necessária para cada missão.
Organize missões diárias e semanais por área: Marketing, Negócios, Saúde, Desenvolvimento, Relacionamentos.
Tom executivo, orientado a ação, em português do Brasil.`;

export const EXECUTION_IA_ACTIONS = [
  {
    id: "fazer-hoje",
    label: "O que devo fazer hoje?",
    prompt: "O que devo fazer hoje?",
  },
  {
    id: "tarefa-importante",
    label: "Tarefa mais importante",
    prompt: "Qual minha tarefa mais importante?",
  },
  {
    id: "atrasado",
    label: "Estou atrasado?",
    prompt: "Estou atrasado?",
  },
  {
    id: "aumentar-sucesso",
    label: "Aumentar chances",
    prompt: "Como aumentar minhas chances de sucesso?",
  },
] as const;

const EXECUTION_TODAY_PHRASES = [
  "o que devo fazer hoje",
  "o que fazer hoje",
  "fazer hoje",
] as const;

const EXECUTION_IMPORTANT_PHRASES = [
  "qual minha tarefa mais importante",
  "tarefa mais importante",
  "mais importante",
] as const;

const EXECUTION_LATE_PHRASES = [
  "estou atrasado",
  "to atrasado",
  "estou atrasada",
] as const;

const EXECUTION_SUCCESS_PHRASES = [
  "como aumentar minhas chances",
  "aumentar chances de sucesso",
  "chances de sucesso",
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

export type ExecutionCoachMode =
  | "execution-today"
  | "execution-important"
  | "execution-late"
  | "execution-success";

export function detectExecutionCoachMode(message: string): ExecutionCoachMode | null {
  const normalized = normalize(message);
  if (!normalized) return null;
  if (matchesAny(normalized, EXECUTION_SUCCESS_PHRASES)) return "execution-success";
  if (matchesAny(normalized, EXECUTION_LATE_PHRASES)) return "execution-late";
  if (matchesAny(normalized, EXECUTION_IMPORTANT_PHRASES)) return "execution-important";
  if (matchesAny(normalized, EXECUTION_TODAY_PHRASES)) return "execution-today";
  return null;
}

export function parseBriefing(json: unknown): DailyBriefing | null {
  if (!json || typeof json !== "object") return null;
  const obj = json as DailyBriefing;
  if (!obj.greeting && !obj.projeto_prioritario) return null;
  return obj;
}

export function buildGreeting(displayName: string): string {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return `${greeting}, ${displayName}.`;
}

export function computeExecutionDashboard(
  plan: ExecutionPlan | null,
  tasks: ExecutionTask[],
  historyToday: ExecutionHistoryEntry[]
): ExecutionDashboardMetrics {
  const daily = tasks.filter((t) => t.categoria === "diaria");
  const weekly = tasks.filter((t) => t.categoria === "semanal");
  const completed = tasks.filter((t) => t.status === "completed").length;
  const xpGanhoHoje = historyToday.reduce((sum, h) => sum + (h.xp_ganho ?? 0), 0);

  return {
    scoreExecucao: plan?.score_execucao ?? 0,
    missoesConcluidas: plan?.missoes_concluidas ?? completed,
    missoesTotal: plan?.missoes_total ?? tasks.length,
    missoesDiariasPendentes: daily.filter((t) => t.status === "pending").length,
    missoesSemanaisPendentes: weekly.filter((t) => t.status === "pending").length,
    xpGanhoHoje,
    planoAtivo: !!plan && plan.status === "active",
  };
}

export function getDailyTasks(tasks: ExecutionTask[]): ExecutionTask[] {
  return tasks
    .filter((t) => t.categoria === "diaria")
    .sort((a, b) => Number(b.prioridade) - Number(a.prioridade));
}

export function getWeeklyTasksByArea(
  tasks: ExecutionTask[]
): Record<ExecutionTaskArea, ExecutionTask[]> {
  const weekly = tasks.filter((t) => t.categoria === "semanal");
  const result: Record<ExecutionTaskArea, ExecutionTask[]> = {
    marketing: [],
    negocios: [],
    saude: [],
    desenvolvimento: [],
    relacionamentos: [],
  };

  for (const task of weekly) {
    result[task.area]?.push(task);
  }

  for (const area of Object.keys(result) as ExecutionTaskArea[]) {
    result[area].sort((a, b) => Number(b.prioridade) - Number(a.prioridade));
  }

  return result;
}

export function buildExecutionAuraContext(
  plan: ExecutionPlan | null,
  tasks: ExecutionTask[],
  dashboard: ExecutionDashboardMetrics
): string {
  if (!plan) return "Nenhum plano de execução ativo para hoje.";

  const briefing = parseBriefing(plan.briefing);
  const pending = tasks.filter((t) => t.status === "pending");

  return [
    `Plano: ${plan.titulo ?? "Execução diária"}`,
    `Data: ${plan.plan_date}`,
    `Score: ${dashboard.scoreExecucao}/100`,
    `Progresso: ${dashboard.missoesConcluidas}/${dashboard.missoesTotal}`,
    briefing
      ? `Projeto: ${briefing.projeto_prioritario} · Meta: ${briefing.meta_financeira} · Prob: ${briefing.probabilidade_atual}%`
      : "",
    `Pendentes: ${pending.length} (${dashboard.missoesDiariasPendentes} diárias, ${dashboard.missoesSemanaisPendentes} semanais)`,
    pending
      .slice(0, 5)
      .map(
        (t) =>
          `• ${t.titulo} [P:${t.prioridade} I:${t.impacto} U:${t.urgencia} ROI:${t.roi}% E:${t.energia}]`
      )
      .join("\n"),
  ]
    .filter(Boolean)
    .join("\n");
}

export function getAreaLabel(area: ExecutionTaskArea): string {
  return EXECUTION_AREAS.find((a) => a.id === area)?.label ?? area;
}

export function getModuloLabel(modulo: ExecutionTaskModulo): string {
  return EXECUTION_MODULO_LABELS[modulo] ?? modulo;
}

export function formatMetaFinanceira(valor: number | null | undefined): string {
  if (valor == null || valor <= 0) return "—";
  return formatBRL(valor);
}

export { formatBRL };
