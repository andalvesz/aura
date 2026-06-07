import type { Goal, GoalTipo } from "@/types/database";
import { formatBRL } from "@/utils/format";
import { isInDateRange } from "@/utils/executive-reports";

export const GOAL_TIPO_LABELS: Record<GoalTipo, string> = {
  financeira: "Financeira",
  saude: "Saúde",
  conteudo: "Conteúdo",
  vendas: "Vendas",
  eventos: "Eventos",
  personalizada: "Personalizada",
};

export const GOAL_TIPO_OPTIONS: { id: GoalTipo; label: string; example: string }[] = [
  { id: "financeira", label: "Financeira", example: "Ganhar R$ 5.000 em Junho" },
  { id: "saude", label: "Saúde", example: "Treinar 20 vezes no mês" },
  { id: "conteudo", label: "Conteúdo", example: "Publicar 30 conteúdos" },
  { id: "vendas", label: "Vendas", example: "Fechar 5 contratos" },
  { id: "eventos", label: "Eventos", example: "Fechar 3 eventos Alvesz" },
  { id: "personalizada", label: "Personalizada", example: "Meta personalizada" },
];

function parseLocalDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T12:00:00`);
}

export function getActiveGoals(goals: Goal[], reference = new Date()): Goal[] {
  const today = reference.toISOString().slice(0, 10);
  return goals.filter(
    (g) =>
      g.status === "ativa" && g.data_inicio <= today && g.data_fim >= today
  );
}

export function computeGoalMetrics(goal: Goal, today = new Date()) {
  const meta = Number(goal.meta);
  const atual = Number(goal.atual);
  const pct = meta > 0 ? Math.min(100, Math.round((atual / meta) * 100)) : 0;
  const remaining = Math.max(0, meta - atual);

  const start = parseLocalDate(goal.data_inicio);
  const end = parseLocalDate(goal.data_fim);
  const totalDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const elapsedDays = Math.min(
    totalDays,
    Math.max(0, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  );
  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const timePct = Math.min(100, Math.round((elapsedDays / totalDays) * 100));

  const dailyPace = elapsedDays > 0 ? atual / elapsedDays : 0;
  const forecast = Math.round(atual + dailyPace * remainingDays);
  const forecastPct = meta > 0 ? Math.round((forecast / meta) * 100) : 0;

  return {
    meta,
    atual,
    pct,
    remaining,
    totalDays,
    elapsedDays,
    remainingDays,
    timePct,
    dailyPace,
    forecast,
    forecastPct,
  };
}

export function isGoalBehind(goal: Goal, today = new Date()): boolean {
  if (goal.status !== "ativa") return false;
  const todayIso = today.toISOString().slice(0, 10);
  const { pct, timePct } = computeGoalMetrics(goal, today);
  if (goal.data_fim < todayIso && pct < 100) return true;
  return timePct >= 40 && pct < timePct - 10;
}

export function isGoalReached(goal: Goal): boolean {
  return Number(goal.atual) >= Number(goal.meta);
}

export function formatGoalProgress(goal: Goal): string {
  const m = computeGoalMetrics(goal);
  const unit = goal.tipo === "financeira" ? formatBRL(m.atual) : String(m.atual);
  const target = goal.tipo === "financeira" ? formatBRL(m.meta) : String(m.meta);
  return `${unit} de ${target} (${m.pct}%)`;
}

export function formatGoalForecast(goal: Goal): string {
  const m = computeGoalMetrics(goal);
  if (m.remainingDays <= 0) {
    return m.pct >= 100 ? "Meta atingida" : "Prazo encerrado";
  }
  const forecast =
    goal.tipo === "financeira" ? formatBRL(m.forecast) : String(m.forecast);
  return `Previsão: ${forecast} (${m.forecastPct}% da meta)`;
}

export function sortGoalsByUrgency(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const aBehind = isGoalBehind(a) ? 1 : 0;
    const bBehind = isGoalBehind(b) ? 1 : 0;
    if (bBehind !== aBehind) return bBehind - aBehind;
    const aPct = computeGoalMetrics(a).pct;
    const bPct = computeGoalMetrics(b).pct;
    return aPct - bPct;
  });
}

export function findMostDelayedGoal(goals: Goal[]): Goal | null {
  const active = getActiveGoals(goals);
  const behind = active.filter((g) => isGoalBehind(g));
  if (behind.length === 0) return null;
  return sortGoalsByUrgency(behind)[0] ?? null;
}

export function buildGoalsSummaryLines(goals: Goal[]): string[] {
  const active = getActiveGoals(goals);
  if (active.length === 0) {
    return ["Nenhuma meta ativa — cadastre em Metas."];
  }
  return sortGoalsByUrgency(active).slice(0, 6).map((g) => {
    const m = computeGoalMetrics(g);
    const behind = isGoalBehind(g) ? " ⚠ atrasada" : "";
    return `${GOAL_TIPO_LABELS[g.tipo]} — ${g.titulo}: ${m.pct}% (${m.atual}/${m.meta})${behind}`;
  });
}

export function isDateInGoalRange(
  iso: string | null | undefined,
  goal: Goal
): boolean {
  return isInDateRange(iso, goal.data_inicio, goal.data_fim);
}
