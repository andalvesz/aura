/**
 * Pure prioritizer for "Meu Dia" — no I/O.
 * Orders actionable items by urgency for the authenticated user's day.
 */

export type MyDayPriorityLevel = "ALTA" | "MEDIA" | "BAIXA";

export type MyDayPriorityKind =
  | "evento_atrasado"
  | "habito_atrasado"
  | "orcamento_critico"
  | "objetivo_proximo"
  | "treino_pendente"
  | "viagem_proxima"
  | "expert_erro"
  | "evento_hoje"
  | "habito_pendente"
  | "idioma"
  | "outro";

export type MyDayPriorityItem = {
  id: string;
  kind: MyDayPriorityKind;
  title: string;
  detail?: string | null;
  priority: MyDayPriorityLevel;
  href?: string;
};

export type MyDayPriorityInput = {
  overdueEvents: { id: string; titulo: string }[];
  overdueHabits: { id: string; titulo: string }[];
  pendingHabits: { id: string; titulo: string }[];
  budgetCritical: boolean;
  budgetDetail?: string | null;
  nearGoals: { id: string; titulo: string; prazo: string; remainingDays: number }[];
  workoutPending: boolean;
  tripSoon: { id: string; titulo: string; daysRemaining: number } | null;
  expertErrors: number;
  todayEvents: { id: string; titulo: string }[];
  languageDue: boolean;
};

const RANK: Record<MyDayPriorityLevel, number> = {
  ALTA: 0,
  MEDIA: 1,
  BAIXA: 2,
};

export function prioritizeMyDay(input: MyDayPriorityInput): MyDayPriorityItem[] {
  const items: MyDayPriorityItem[] = [];

  for (const e of input.overdueEvents) {
    items.push({
      id: `evt-overdue-${e.id}`,
      kind: "evento_atrasado",
      title: e.titulo,
      detail: "Evento atrasado",
      priority: "ALTA",
      href: "/dashboard/calendario",
    });
  }

  for (const h of input.overdueHabits) {
    items.push({
      id: `habit-overdue-${h.id}`,
      kind: "habito_atrasado",
      title: h.titulo,
      detail: "Hábito atrasado",
      priority: "ALTA",
      href: "/dashboard/saude",
    });
  }

  if (input.budgetCritical) {
    items.push({
      id: "budget-critical",
      kind: "orcamento_critico",
      title: "Orçamento em alerta",
      detail: input.budgetDetail ?? "Revise despesas do mês",
      priority: "ALTA",
      href: "/dashboard/financeiro",
    });
  }

  if (input.expertErrors > 0) {
    items.push({
      id: "expert-errors",
      kind: "expert_erro",
      title: "Expert Brain com erros",
      detail: `${input.expertErrors} item(ns) com falha`,
      priority: "ALTA",
      href: "/dashboard/expert-brain",
    });
  }

  for (const g of input.nearGoals) {
    items.push({
      id: `goal-${g.id}`,
      kind: "objetivo_proximo",
      title: g.titulo,
      detail: `Prazo em ${g.remainingDays} dia(s)`,
      priority: g.remainingDays <= 3 ? "ALTA" : "MEDIA",
      href: "/dashboard/metas",
    });
  }

  if (input.workoutPending) {
    items.push({
      id: "workout-pending",
      kind: "treino_pendente",
      title: "Treino do dia pendente",
      detail: "Nenhum treino registrado para hoje",
      priority: "MEDIA",
      href: "/dashboard/saude",
    });
  }

  if (input.tripSoon && input.tripSoon.daysRemaining <= 14) {
    items.push({
      id: `trip-${input.tripSoon.id}`,
      kind: "viagem_proxima",
      title: input.tripSoon.titulo,
      detail:
        input.tripSoon.daysRemaining === 0
          ? "Viagem em andamento / hoje"
          : `Faltam ${input.tripSoon.daysRemaining} dia(s)`,
      priority: input.tripSoon.daysRemaining <= 3 ? "ALTA" : "MEDIA",
      href: "/dashboard/viagens",
    });
  }

  for (const e of input.todayEvents) {
    items.push({
      id: `evt-today-${e.id}`,
      kind: "evento_hoje",
      title: e.titulo,
      detail: "Hoje",
      priority: "MEDIA",
      href: "/dashboard/calendario",
    });
  }

  for (const h of input.pendingHabits) {
    items.push({
      id: `habit-pending-${h.id}`,
      kind: "habito_pendente",
      title: h.titulo,
      detail: "Pendente hoje",
      priority: "BAIXA",
      href: "/dashboard/saude",
    });
  }

  if (input.languageDue) {
    items.push({
      id: "language-due",
      kind: "idioma",
      title: "Praticar idioma",
      detail: "Nenhuma prática registrada hoje",
      priority: "BAIXA",
      href: "/dashboard/idiomas",
    });
  }

  return items.sort((a, b) => {
    const byRank = RANK[a.priority] - RANK[b.priority];
    if (byRank !== 0) return byRank;
    return a.title.localeCompare(b.title, "pt-BR");
  });
}

export function summarizeDayNarrative(params: {
  priorityCount: number;
  todayEvents: number;
  pendingHabits: number;
  hasWorkout: boolean;
}): string {
  if (
    params.priorityCount === 0 &&
    params.todayEvents === 0 &&
    params.pendingHabits === 0 &&
    params.hasWorkout
  ) {
    return "Dia leve — rotina básica em dia.";
  }
  if (params.priorityCount === 0 && params.todayEvents === 0 && params.pendingHabits === 0) {
    return "Nada urgente no radar. Bom momento para planejar.";
  }
  const parts: string[] = [];
  if (params.priorityCount > 0) {
    parts.push(`${params.priorityCount} prioridade(s)`);
  }
  if (params.todayEvents > 0) {
    parts.push(`${params.todayEvents} evento(s) hoje`);
  }
  if (params.pendingHabits > 0) {
    parts.push(`${params.pendingHabits} hábito(s) pendente(s)`);
  }
  if (!params.hasWorkout) {
    parts.push("treino em aberto");
  }
  return parts.join(" · ");
}
