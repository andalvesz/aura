import type {
  Evento,
  FinancialGoal,
  FinancialIncome,
  Gasto,
  Goal,
  GrowthLead,
  HealthHabit,
  HealthWorkout,
  Orcamento,
} from "@/types/database";
import { getEventoTipoLabel } from "@/utils/calendar";
import { formatBRL, formatTime, isValidDate } from "@/utils/format";
import {
  computeSmartFinanceStats,
  getCategoryLabel,
} from "@/utils/finance";
import {
  findMostDelayedGoal,
  formatGoalProgress,
  getActiveGoals,
  GOAL_TIPO_LABELS,
  isGoalBehind,
  sortGoalsByUrgency,
  computeGoalMetrics,
} from "@/utils/goals";
import {
  getGrowthLeadStatusLabel,
  sortGrowthLeadOpportunities,
} from "@/utils/growth";
import {
  daysSinceContact,
  getFollowUpIdleTier,
  listStaleOpportunities,
} from "@/utils/follow-up";
import { todayIsoDate, workoutForToday } from "@/utils/health";
import {
  getOrcamentoStatusLabel,
  normalizeOrcamentoStatus,
} from "@/utils/alvesz-integration";
import type { OrcamentoWithCliente } from "@/utils/nexus";

export type DailySummarySection = {
  id: string;
  emoji: string;
  label: string;
  lines: string[];
  href: string;
  emptyHint: string;
};

export type DailyPriority = {
  rank: number;
  text: string;
  href: string;
  score: number;
};

export type DailyOperationsInput = {
  eventos: Evento[];
  growthLeads: GrowthLead[];
  orcamentos: OrcamentoWithCliente[];
  gastos: Gasto[];
  financialIncome: FinancialIncome[];
  financialGoals: FinancialGoal[];
  financialBalance: number | null;
  healthHabits: HealthHabit[];
  healthWorkouts: HealthWorkout[];
  goals: Goal[];
};

type PriorityCandidate = {
  text: string;
  href: string;
  score: number;
};

function todayEvents(eventos: Evento[]) {
  const today = todayIsoDate();
  return eventos
    .filter((e) => isValidDate(e.data_inicio) && e.data_inicio.slice(0, 10) === today)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
}

function pendingOrcamentos(orcamentos: OrcamentoWithCliente[]) {
  return orcamentos.filter((o) => {
    const status = normalizeOrcamentoStatus(o.status);
    return status === "rascunho" || status === "enviado" || status === "negociacao";
  });
}

function pendingHabits(habits: HealthHabit[]) {
  const today = todayIsoDate();
  return habits.filter((h) => h.data === today && h.status !== "concluido");
}

function staleLeads(input: DailyOperationsInput) {
  return listStaleOpportunities({
    leads: input.growthLeads,
    orcamentos: input.orcamentos as Orcamento[],
  });
}

export function buildDailySummary(input: DailyOperationsInput): DailySummarySection[] {
  const today = todayIsoDate();
  const events = todayEvents(input.eventos);
  const stale = staleLeads(input);
  const pendingBudgets = pendingOrcamentos(input.orcamentos);
  const habits = pendingHabits(input.healthHabits);
  const finance = computeSmartFinanceStats({
    gastos: input.gastos,
    income: input.financialIncome,
    goals: input.financialGoals,
    initialBalance: input.financialBalance,
  });
  const delayedGoals = sortGoalsByUrgency(getActiveGoals(input.goals)).filter((g) =>
    isGoalBehind(g)
  );

  const eventLines = events.map(
    (e) =>
      `${formatTime(e.data_inicio)} — ${e.titulo}${e.local ? ` · ${e.local}` : ""} (${getEventoTipoLabel(e.tipo)})`
  );

  const staleLeadLines =
    stale.length > 0
      ? stale.slice(0, 4).map(
          (s) =>
            `${s.context.nome} — ${s.context.idleDays}d sem contato · ${formatBRL(s.context.valor)}`
        )
      : sortGrowthLeadOpportunities(
          input.growthLeads.filter((l) => l.status !== "fechado" && l.status !== "perdido")
        )
          .slice(0, 3)
          .filter((l) => getFollowUpIdleTier(daysSinceContact(l.updated_at)))
          .map(
            (l) =>
              `${l.nome} — ${getGrowthLeadStatusLabel(l.status)} · ${formatBRL(l.valor_potencial ?? 0)}`
          );

  const budgetLines = pendingBudgets.slice(0, 4).map((o) => {
    const nome = o.clientes?.nome ?? o.tipo_evento;
    return `${nome} — ${getOrcamentoStatusLabel(normalizeOrcamentoStatus(o.status))} · ${formatBRL(o.valor_total)}`;
  });

  const financeLines: string[] = [];
  if (finance.saldoAtual != null) {
    financeLines.push(`Saldo atual: ${formatBRL(finance.saldoAtual)}`);
  }
  financeLines.push(
    `Receitas do mês: ${formatBRL(finance.totalIncomeMonth)} · Gastos: ${formatBRL(finance.totalMonth)}`
  );
  if (finance.activeGoal && finance.goalProgress) {
    financeLines.push(
      `Meta "${finance.activeGoal.titulo}": ${finance.goalProgress.pct}% (${formatBRL(finance.goalProgress.remaining)} restantes)`
    );
  }
  if (finance.topCategory) {
    financeLines.push(
      `Maior gasto: ${finance.topCategory.label} (${finance.topCategory.pct}% do mês)`
    );
  }

  const habitLines = habits.slice(0, 5).map((h) => h.titulo);
  const workout = workoutForToday(input.healthWorkouts);
  if (workout && !habitLines.some((l) => l.includes(workout.nome))) {
    habitLines.unshift(`${workout.nome} (${workout.grupo_muscular})`);
  }

  const goalLines = delayedGoals.slice(0, 3).map((g) => {
    const tipo = GOAL_TIPO_LABELS[g.tipo];
    return `${g.titulo} (${tipo}) — ${formatGoalProgress(g)}`;
  });

  return [
    {
      id: "compromissos",
      emoji: "📅",
      label: "Compromissos de hoje",
      lines: eventLines,
      href: "/dashboard/calendario",
      emptyHint: "Nenhum compromisso agendado para hoje.",
    },
    {
      id: "leads",
      emoji: "🎯",
      label: "Leads sem follow-up",
      lines: staleLeadLines,
      href: "/dashboard/crescimento",
      emptyHint: "Nenhum lead precisa de follow-up urgente.",
    },
    {
      id: "orcamentos",
      emoji: "🍸",
      label: "Orçamentos pendentes",
      lines: budgetLines,
      href: "/dashboard/alvesz",
      emptyHint: "Nenhum orçamento Alvesz pendente.",
    },
    {
      id: "financas",
      emoji: "💰",
      label: "Situação financeira",
      lines: financeLines,
      href: "/dashboard/financeiro",
      emptyHint: "Cadastre receitas e gastos para ver o resumo.",
    },
    {
      id: "habitos",
      emoji: "🔥",
      label: "Hábitos pendentes",
      lines: habitLines,
      href: "/dashboard/saude",
      emptyHint: "Hábitos de hoje concluídos ou nenhum cadastrado.",
    },
    {
      id: "metas",
      emoji: "🏆",
      label: "Metas mais atrasadas",
      lines: goalLines,
      href: "/dashboard/metas",
      emptyHint: "Nenhuma meta ativa atrasada.",
    },
  ];
}

function buildPriorityCandidates(input: DailyOperationsInput): PriorityCandidate[] {
  const candidates: PriorityCandidate[] = [];
  const today = todayIsoDate();
  const stale = staleLeads(input);
  const events = todayEvents(input.eventos);
  const habits = pendingHabits(input.healthHabits);
  const pendingBudgets = pendingOrcamentos(input.orcamentos);
  const finance = computeSmartFinanceStats({
    gastos: input.gastos,
    income: input.financialIncome,
    goals: input.financialGoals,
    initialBalance: input.financialBalance,
  });

  const topStale = stale[0];
  if (topStale) {
    candidates.push({
      text: `Fazer follow-up de ${topStale.context.nome}`,
      href: "/dashboard/crescimento",
      score: 1000 + topStale.context.valor + topStale.context.idleDays * 20,
    });
  }

  for (const lead of sortGrowthLeadOpportunities(input.growthLeads).slice(0, 3)) {
    if (topStale?.lead?.id === lead.id) continue;
    const idleDays = daysSinceContact(lead.updated_at);
    const tier = getFollowUpIdleTier(idleDays);
    if (!tier) continue;
    candidates.push({
      text: `Fazer follow-up de ${lead.nome}`,
      href: "/dashboard/crescimento",
      score: 800 + (lead.valor_potencial ?? 0) / 10 + tier * 15,
    });
  }

  const topBudget = pendingBudgets.sort(
    (a, b) => Number(b.valor_total) - Number(a.valor_total)
  )[0];
  if (topBudget) {
    const nome = topBudget.clientes?.nome ?? topBudget.tipo_evento;
    candidates.push({
      text: `Avançar orçamento de ${nome} (${getOrcamentoStatusLabel(normalizeOrcamentoStatus(topBudget.status))})`,
      href: "/dashboard/alvesz",
      score: 700 + Number(topBudget.valor_total) / 100,
    });
  }

  const nextEvent = events.find((e) => new Date(e.data_inicio) >= new Date()) ?? events[0];
  if (nextEvent) {
    candidates.push({
      text: `${nextEvent.titulo} às ${formatTime(nextEvent.data_inicio)}`,
      href: "/dashboard/calendario",
      score: 650 + (24 - new Date(nextEvent.data_inicio).getHours()),
    });
  }

  const workout = workoutForToday(input.healthWorkouts);
  if (workout) {
    candidates.push({
      text: `Treino de ${workout.grupo_muscular}: ${workout.nome}`,
      href: "/dashboard/saude",
      score: 600,
    });
  }

  for (const habit of habits.slice(0, 2)) {
    candidates.push({
      text: `Concluir hábito: ${habit.titulo}`,
      href: "/dashboard/saude",
      score: 550,
    });
  }

  const delayed = findMostDelayedGoal(input.goals);
  if (delayed) {
    const metrics = computeGoalMetrics(delayed);
    candidates.push({
      text: `Recuperar meta: ${delayed.titulo}`,
      href: "/dashboard/metas",
      score: 500 + (100 - metrics.pct) * 5,
    });
  }

  const gastosHoje = input.gastos.filter((g) => g.data === today);
  if (finance.totalMonth > 0 && gastosHoje.length === 0 && finance.dayOfMonth > 3) {
    candidates.push({
      text: "Registrar despesas pendentes",
      href: "/dashboard/financeiro",
      score: 480,
    });
  }

  if (finance.expenseAlert.unusual) {
    candidates.push({
      text: `Revisar gastos — ${getCategoryLabel(finance.topCategory?.key ?? "outros")} em alta`,
      href: "/dashboard/financeiro",
      score: 520,
    });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

export function buildDailyTopPriorities(input: DailyOperationsInput): DailyPriority[] {
  const seen = new Set<string>();
  const priorities: DailyPriority[] = [];

  for (const candidate of buildPriorityCandidates(input)) {
    const key = candidate.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    priorities.push({
      rank: priorities.length + 1,
      text: candidate.text,
      href: candidate.href,
      score: candidate.score,
    });
    if (priorities.length >= 3) break;
  }

  if (priorities.length === 0) {
    return [
      {
        rank: 1,
        text: "Cadastre leads, eventos ou hábitos para personalizar suas prioridades",
        href: "/dashboard",
        score: 0,
      },
    ];
  }

  while (priorities.length < 3) {
    priorities.push({
      rank: priorities.length + 1,
      text: "Revise seus módulos e registre o progresso do dia",
      href: "/dashboard",
      score: 0,
    });
  }

  return priorities;
}

export function buildCoachNowResponse(
  input: DailyOperationsInput,
  displayName = "Anderson"
): string {
  const priorities = buildDailyTopPriorities(input);
  const top = priorities[0];
  const summary = buildDailySummary(input);

  const urgentSections = summary.filter(
    (s) => s.lines.length > 0 && s.id !== "financas"
  );
  const contextLines = urgentSections
    .slice(0, 2)
    .map((s) => `${s.emoji} ${s.label}: ${s.lines[0]}`)
    .join("\n");

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return `${greeting}, ${displayName}.

**Agora:** ${top.text}

${priorities.length > 1 ? `**Em seguida:**\n${priorities.slice(1).map((p) => `${p.rank}. ${p.text}`).join("\n")}\n` : ""}${contextLines ? `\n**Contexto:**\n${contextLines}\n` : ""}
Execute a ação principal nos próximos 30 minutos e registre o resultado na Aura.`;
}

export function hasDailyOperationsData(input: DailyOperationsInput): boolean {
  return (
    input.eventos.length > 0 ||
    input.growthLeads.length > 0 ||
    input.orcamentos.length > 0 ||
    input.gastos.length > 0 ||
    input.financialIncome.length > 0 ||
    input.healthHabits.length > 0 ||
    input.healthWorkouts.length > 0 ||
    input.goals.length > 0
  );
}
