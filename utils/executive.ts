import type {
  Conteudo,
  Evento,
  Gasto,
  GrowthGoal,
  GrowthLead,
  GrowthMission,
  HealthHabit,
  HealthWorkout,
  Orcamento,
} from "@/types/database";
import { getEventoTipoLabel } from "@/utils/calendar";
import { formatBRL, formatTime, isToday, isValidDate } from "@/utils/format";
import { computeFinanceStats } from "@/utils/finance";
import {
  analyzeGrowthLeadContentInsights,
  computeGrowthLeadMetrics,
  computeRevenueProgress,
  getCurrentGoal,
  getGrowthLeadPriority,
  getGrowthLeadStatusLabel,
  mergeDailyMissions,
  sortGrowthLeadOpportunities,
} from "@/utils/growth";
import {
  daysSinceContact,
  getFollowUpIdleTier,
  getTopStaleOpportunity,
} from "@/utils/follow-up";
import { todayIsoDate, workoutsThisWeek } from "@/utils/health";
import { normalizeOrcamentoStatus } from "@/utils/alvesz-integration";
import { computeAlveszMetrics, filterUpcomingEventos } from "@/utils/nexus";
import {
  getConteudoStatusLabel,
  normalizeConteudoStatus,
} from "@/utils/social";
import type { OrcamentoWithCliente } from "@/utils/nexus";

export type ExecutiveDaySummary = {
  greeting: string;
  dateLabel: string;
  nextEvent: Evento | null;
  topHabit: HealthHabit | null;
  pendingMissionsCount: number;
  bullets: string[];
};

export type ExecutiveKpis = {
  receitaMes: number;
  receitaMesLabel: string;
  leadsAtivos: number;
  conteudosPendentes: number;
  habitosConcluidos: number;
  habitosTotalHoje: number;
  treinosSemana: number;
  eventosAgendados: number;
};

export type ExecutivePriorityItem = {
  id: string;
  title: string;
  subtitle: string;
  priority: number;
  href: string;
  kind: "lead" | "orcamento" | "conteudo" | "habito";
};

export type ExecutiveAgendaItem = {
  id: string;
  time: string;
  title: string;
  origem: string;
  href: string;
};

export type ExecutiveFeedItem = {
  label: string;
  text: string;
};

export function getExecutiveGreeting(name = "Anderson"): string {
  const hour = new Date().getHours();
  if (hour < 12) return `Bom dia, ${name}.`;
  if (hour < 18) return `Boa tarde, ${name}.`;
  return `Boa noite, ${name}.`;
}

export function formatExecutiveDateLabel(): string {
  try {
    const formatted = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date());
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return "Hoje";
  }
}

function pluralize(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

export function buildExecutiveDaySummary(params: {
  eventos: Evento[];
  leads: GrowthLead[];
  conteudos: Conteudo[];
  missions: GrowthMission[];
  habits: HealthHabit[];
  workouts: HealthWorkout[];
}): ExecutiveDaySummary {
  const { eventos, leads, conteudos, missions, habits, workouts } = params;
  const today = todayIsoDate();
  const todayEvents = eventos.filter(
    (e) => isValidDate(e.data_inicio) && e.data_inicio.slice(0, 10) === today
  );
  const upcomingToday = todayEvents
    .filter((e) => new Date(e.data_inicio) >= new Date())
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  const nextEvent = upcomingToday[0] ?? filterUpcomingEventos(eventos, 7)[0] ?? null;

  const activeLeads = leads.filter(
    (l) => l.status !== "fechado" && l.status !== "perdido"
  );
  const pendingContent = conteudos.filter(
    (c) => normalizeConteudoStatus(c.status) !== "publicado"
  );
  const pendingMissions = mergeDailyMissions(missions).filter(
    (m) => m.status === "pending"
  );
  const habitsHoje = habits.filter((h) => h.data === today);
  const topHabit =
    habitsHoje.find((h) => h.status === "ativo") ??
    habitsHoje[0] ??
    null;
  const treinoHoje = workouts.find((w) => w.data === today);

  const bullets: string[] = [];

  if (todayEvents.length > 0) {
    bullets.push(pluralize(todayEvents.length, "evento", "eventos"));
  }
  if (activeLeads.length > 0) {
    bullets.push(
      pluralize(activeLeads.length, "lead para acompanhar", "leads para acompanhar")
    );
  }
  if (pendingContent.length > 0) {
    bullets.push(
      pluralize(pendingContent.length, "conteúdo pendente", "conteúdos pendentes")
    );
  }
  if (treinoHoje) {
    bullets.push("1 treino programado");
  } else if (pendingMissions.length > 0) {
    bullets.push(
      pluralize(pendingMissions.length, "missão pendente", "missões pendentes")
    );
  }

  return {
    greeting: getExecutiveGreeting(),
    dateLabel: formatExecutiveDateLabel(),
    nextEvent,
    topHabit,
    pendingMissionsCount: pendingMissions.length,
    bullets,
  };
}

export function buildExecutiveKpis(params: {
  goals: GrowthGoal[];
  leads: GrowthLead[];
  conteudos: Conteudo[];
  habits: HealthHabit[];
  workouts: HealthWorkout[];
  eventos: Evento[];
  orcamentos: OrcamentoWithCliente[];
  gastos: Gasto[];
}): ExecutiveKpis {
  const { goals, leads, conteudos, habits, workouts, eventos, orcamentos, gastos } =
    params;

  const currentGoal = getCurrentGoal(goals);
  const leadMetrics = computeGrowthLeadMetrics(leads);
  const alveszMetrics = computeAlveszMetrics(orcamentos);
  const financeStats = computeFinanceStats(gastos);

  const receitaMes =
    (currentGoal?.receita_atual ?? 0) +
    leadMetrics.receita +
    alveszMetrics.receitaAprovada;

  const receitaProgress = currentGoal
    ? computeRevenueProgress(currentGoal)
    : null;

  const today = todayIsoDate();
  const habitsHoje = habits.filter((h) => h.data === today);
  const habitosConcluidos = habitsHoje.filter((h) => h.status === "concluido").length;

  return {
    receitaMes,
    receitaMesLabel:
      currentGoal && currentGoal.meta_receita_mensal > 0
        ? `${receitaProgress ?? 0}% da meta`
        : financeStats.totalMonth > 0
          ? `${formatBRL(financeStats.totalMonth)} em gastos`
          : "Sem meta definida",
    leadsAtivos: leadMetrics.ativos,
    conteudosPendentes: conteudos.filter(
      (c) => normalizeConteudoStatus(c.status) !== "publicado"
    ).length,
    habitosConcluidos,
    habitosTotalHoje: habitsHoje.length,
    treinosSemana: workoutsThisWeek(workouts).length,
    eventosAgendados: filterUpcomingEventos(eventos, 30).length,
  };
}

function priorityScore(status: string): number {
  const p = getGrowthLeadPriority(
    status as Parameters<typeof getGrowthLeadPriority>[0]
  );
  if (p === "ALTA") return 90;
  if (p === "MÉDIA") return 60;
  return 30;
}

export function buildExecutivePriorityItems(params: {
  leads: GrowthLead[];
  orcamentos: OrcamentoWithCliente[];
  conteudos: Conteudo[];
  habits: HealthHabit[];
}): ExecutivePriorityItem[] {
  const { leads, orcamentos, conteudos, habits } = params;
  const today = todayIsoDate();
  const items: ExecutivePriorityItem[] = [];

  const staleTop = getTopStaleOpportunity({ leads, orcamentos });

  for (const lead of sortGrowthLeadOpportunities(leads).slice(0, 5)) {
    if (lead.status === "fechado" || lead.status === "perdido") continue;
    const idleDays = daysSinceContact(lead.updated_at);
    const tier = getFollowUpIdleTier(idleDays);
    const staleBoost = tier ? tier * 15 : 0;
    items.push({
      id: `lead-${lead.id}`,
      title: lead.nome,
      subtitle: tier
        ? `Follow-up · ${idleDays}d sem contato · ${formatBRL(lead.valor_potencial ?? 0)}`
        : `${getGrowthLeadStatusLabel(lead.status)} · ${formatBRL(lead.valor_potencial ?? 0)}`,
      priority:
        priorityScore(lead.status) +
        (lead.valor_potencial ?? 0) / 1000 +
        staleBoost +
        (staleTop?.lead?.id === lead.id ? 50 : 0),
      href: "/dashboard/crescimento",
      kind: "lead",
    });
  }

  for (const orc of orcamentos.filter((o) => {
    const s = normalizeOrcamentoStatus(o.status);
    return s === "rascunho" || s === "enviado" || s === "negociacao";
  })) {
    items.push({
      id: `orc-${orc.id}`,
      title: orc.clientes?.nome ?? orc.tipo_evento,
      subtitle: `Orçamento ${orc.status} · ${formatBRL(orc.valor_total)}`,
      priority: 75 + Number(orc.valor_total) / 1000,
      href: "/dashboard/alvesz",
      kind: "orcamento",
    });
  }

  const now = new Date();
  for (const c of conteudos) {
    const status = normalizeConteudoStatus(c.status);
    if (status === "publicado") continue;
    const planned =
      c.data_publicacao && isValidDate(c.data_publicacao)
        ? new Date(c.data_publicacao)
        : null;
    const isLate = planned != null && planned < now;
    if (!isLate && status === "ideia") continue;
    items.push({
      id: `content-${c.id}`,
      title: c.titulo,
      subtitle: isLate
        ? `Atrasado · ${getConteudoStatusLabel(status)}`
        : getConteudoStatusLabel(status),
      priority: isLate ? 85 : 40,
      href: "/dashboard/social-media",
      kind: "conteudo",
    });
  }

  for (const h of habits.filter((h) => h.data === today && h.status === "ativo")) {
    items.push({
      id: `habit-${h.id}`,
      title: h.titulo,
      subtitle: "Hábito não concluído hoje",
      priority: 50,
      href: "/dashboard/saude",
      kind: "habito",
    });
  }

  return items.sort((a, b) => b.priority - a.priority).slice(0, 8);
}

export function buildExecutiveAgenda(eventos: Evento[]): ExecutiveAgendaItem[] {
  const upcoming = filterUpcomingEventos(eventos, 14).slice(0, 8);

  return upcoming.map((evento) => ({
    id: evento.id,
    time: formatExecutiveAgendaTime(evento.data_inicio),
    title: evento.titulo,
    origem: getEventoTipoLabel(evento.tipo),
    href: "/dashboard/calendario",
  }));
}

function formatExecutiveAgendaTime(dataInicio: string): string {
  if (!isValidDate(dataInicio)) return "Horário não definido";
  const datePart = dataInicio.slice(0, 10);
  if (isToday(datePart)) return formatTime(dataInicio);
  const day = dataInicio.slice(8, 10);
  const month = dataInicio.slice(5, 7);
  if (!/^\d{2}$/.test(day) || !/^\d{2}$/.test(month)) {
    return formatTime(dataInicio);
  }
  return `${day}/${month} ${formatTime(dataInicio)}`;
}

export function buildExecutiveFeedFallback(params: {
  leads: GrowthLead[];
  conteudos: Conteudo[];
  habits: HealthHabit[];
  workouts: HealthWorkout[];
  missions: GrowthMission[];
  goals: GrowthGoal[];
}): ExecutiveFeedItem[] {
  const { leads, conteudos, habits, workouts, missions, goals } = params;
  const insights = analyzeGrowthLeadContentInsights(leads);
  const topLead = sortGrowthLeadOpportunities(leads)[0];
  const pendingContent = conteudos.filter(
    (c) => normalizeConteudoStatus(c.status) !== "publicado"
  );
  const currentGoal = getCurrentGoal(goals);
  const treinoHoje = workouts.find((w) => w.data === todayIsoDate());
  const pendingMissions = mergeDailyMissions(missions).filter(
    (m) => m.status === "pending"
  );

  const oportunidade =
    insights.maiorDemanda && insights.maiorDemanda !== "Outros"
      ? `Maior demanda no CRM: ${insights.maiorDemanda}. Priorize conteúdo e follow-ups neste nicho.`
      : pendingMissions.length > 0
        ? `Conclua a missão "${pendingMissions[0]?.titulo}" para manter momentum comercial.`
        : "Cadastre leads e metas para personalizar oportunidades da semana.";

  const leadText = topLead
    ? `${topLead.nome} (${getGrowthLeadStatusLabel(topLead.status).toLowerCase()}) — ${formatBRL(topLead.valor_potencial ?? 0)}`
    : "Nenhum lead ativo. Cadastre oportunidades no CRM.";

  const contentText =
    pendingContent.length > 0
      ? `Produza "${pendingContent[0]?.titulo}" (${getConteudoStatusLabel(normalizeConteudoStatus(pendingContent[0]?.status ?? "ideia"))}).`
      : insights.maiorDemanda
        ? `Crie conteúdo sobre ${insights.maiorDemanda.toLowerCase()} para alimentar o funil.`
        : "Planeje ideias de Reels no Social Media.";

  const habitsHoje = habits.filter((h) => h.data === todayIsoDate());
  const saudeText = treinoHoje
    ? `Treino de hoje: ${treinoHoje.nome} (${treinoHoje.grupo_muscular}).`
    : habitsHoje.length > 0
      ? `Foque em: ${habitsHoje[0]?.titulo}.`
      : "Registre hábitos e treinos no módulo Saúde.";

  const metaText =
    currentGoal && currentGoal.meta_receita_mensal > 0
      ? `Meta mensal: ${formatBRL(currentGoal.receita_atual ?? 0)} de ${formatBRL(currentGoal.meta_receita_mensal)}.`
      : "Defina sua meta mensal em Crescimento.";

  return [
    { label: "Oportunidade principal da semana", text: oportunidade },
    { label: "Lead mais importante", text: leadText },
    { label: "Conteúdo recomendado", text: contentText },
    { label: "Foco de saúde", text: saudeText },
    { label: "Meta do mês", text: metaText },
  ];
}

export function hasAnyExecutiveData(params: {
  eventos: Evento[];
  leads: GrowthLead[];
  conteudos: Conteudo[];
  habits: HealthHabit[];
  workouts: HealthWorkout[];
  orcamentos: Orcamento[];
  gastos: Gasto[];
}): boolean {
  return (
    params.eventos.length > 0 ||
    params.leads.length > 0 ||
    params.conteudos.length > 0 ||
    params.habits.length > 0 ||
    params.workouts.length > 0 ||
    params.orcamentos.length > 0 ||
    params.gastos.length > 0
  );
}
