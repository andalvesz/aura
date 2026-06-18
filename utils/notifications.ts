import type {
  Cliente,
  Conteudo,
  Evento,
  FinancialGoal,
  FinancialIncome,
  Gasto,
  Goal,
  GrowthLead,
  GrowthMission,
  HealthHabit,
  HealthWorkout,
  Notification,
  NotificationType,
  Orcamento,
} from "@/types/database";
import { normalizeOrcamentoStatus } from "@/utils/alvesz-integration";
import {
  detectUnusualExpense,
  filterGastosCurrentMonth,
  filterIncomeCurrentMonth,
  getActiveFinancialGoal,
  isGoalReached,
} from "@/utils/finance";
import { getFollowUpTierLabel, listStaleOpportunities } from "@/utils/follow-up";
import { mergeDailyMissions, getTodayDate } from "@/utils/growth";
import { getActiveGoals, isGoalBehind as isAuraGoalBehind } from "@/utils/goals";
import { todayIsoDate, workoutForToday } from "@/utils/health";
import { normalizeConteudoStatus } from "@/utils/social";
import { formatBRL, formatTime } from "@/utils/format";
import type { ModuleId } from "@/lib/modules";

export type NotificationCandidate = {
  title: string;
  message: string;
  type: NotificationType;
  related_module: ModuleId | null;
  related_id: string | null;
  scheduled_for: string | null;
};

/** Tipos prioritários exibidos na Central Inteligente da Aura */
export const AURA_PRIORITY_NOTIFICATION_TYPES: NotificationType[] = [
  "lead_followup",
  "event_tomorrow",
  "event_upcoming",
  "goal_behind",
  "habit_pending",
  "budget_waiting",
  "budget_negotiation",
  "revenue_below_target",
  "financial_goal_behind",
  "autopilot_action_required",
  "autopilot_rule_triggered",
  "autopilot_campaign_paused",
  "autopilot_opportunity_found",
];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  lead_followup: "Lead sem follow-up",
  event_upcoming: "Evento hoje",
  event_tomorrow: "Evento amanhã",
  mission_pending: "Missão pendente",
  content_overdue: "Conteúdo atrasado",
  workout_planned: "Treino planejado",
  budget_negotiation: "Orçamento em negociação",
  budget_waiting: "Orçamento aguardando resposta",
  habit_pending: "Hábito não concluído",
  goal_behind: "Meta atrasada",
  revenue_below_target: "Receita abaixo da meta",
  financial_goal_behind: "Meta financeira atrasada",
  financial_expense_spike: "Despesa acima do normal",
  financial_goal_reached: "Meta financeira atingida",
  autopilot_action_required: "Autopilot: aprovação necessária",
  autopilot_rule_triggered: "Autopilot: regra acionada",
  autopilot_campaign_paused: "Autopilot: campanha pausada",
  autopilot_opportunity_found: "Autopilot: oportunidade encontrada",
};

export const NOTIFICATION_MODULE_HREFS: Record<ModuleId, string> = {
  financeiro: "/dashboard/financeiro",
  calendario: "/dashboard/calendario",
  alvesz: "/dashboard/alvesz",
  saude: "/dashboard/saude",
  "social-media": "/dashboard/social-media",
  consorcios: "/dashboard/consorcios",
  crescimento: "/dashboard/crescimento",
  comunicacao: "/dashboard/comunicacao",
  viagens: "/dashboard/viagens",
  idiomas: "/dashboard/idiomas",
  "disney-nba": "/dashboard/disney-nba",
  legado: "/dashboard/legado",
  creator: "/dashboard/creator",
  "smart-launch": "/dashboard/smart-launch",
  "mission": "/dashboard/mission",
  money: "/dashboard/money",
  revenue: "/dashboard/revenue",
  "revenue-ai": "/dashboard/revenue-ai",
  ceo: "/dashboard/ceo",
  "operation-center": "/dashboard/operation-center",
  execution: "/dashboard/execution",
  performance: "/dashboard/performance",
  "growth-brain": "/dashboard/growth-brain",
  "market-hunter": "/dashboard/market-hunter",
  "offer-engine": "/dashboard/offer-engine",
  "funnel-pages": "/dashboard/funnel-pages",
  "conversion-intelligence": "/dashboard/conversion-intelligence",
  excellence: "/dashboard/excellence",
  "ads-commander": "/dashboard/ads-commander",
  "creative-director": "/dashboard/creative-director",
  autopilot: "/dashboard/creator/autopilot",
  "product-factory": "/dashboard/creator/factory",
  platforms: "/dashboard/platforms",
  integrations: "/dashboard/integrations",
  global: "/dashboard/global",
  knowledge: "/dashboard/knowledge",
};

export function isNotificationRead(notification: Pick<Notification, "status">): boolean {
  return notification.status === "read";
}

export function getNotificationHref(notification: Notification): string {
  if (notification.type === "goal_behind") {
    return "/dashboard/metas";
  }
  if (
    notification.type === "autopilot_action_required" ||
    notification.type === "autopilot_rule_triggered" ||
    notification.type === "autopilot_campaign_paused" ||
    notification.type === "autopilot_opportunity_found"
  ) {
    return "/dashboard/creator/autopilot";
  }
  if (notification.related_module) {
    return NOTIFICATION_MODULE_HREFS[notification.related_module as ModuleId];
  }
  return "/dashboard/notificacoes";
}

function tomorrowIsoDate(reference = new Date()): string {
  const d = new Date(reference);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isRevenueBelowTarget(
  goal: FinancialGoal,
  income: FinancialIncome[],
  reference = new Date()
): boolean {
  if (isGoalReached(goal)) return false;

  const monthIncome = filterIncomeCurrentMonth(income).reduce(
    (sum, row) => sum + Number(row.valor),
    0
  );
  const meta = Number(goal.valor_meta);
  const dayOfMonth = reference.getDate();
  const daysInMonth = new Date(
    reference.getFullYear(),
    reference.getMonth() + 1,
    0
  ).getDate();
  const expectedByNow = (meta / daysInMonth) * dayOfMonth;

  return dayOfMonth >= 5 && monthIncome < expectedByNow * 0.9;
}

export function buildNotificationCandidates(params: {
  leads: GrowthLead[];
  eventos: Evento[];
  missions: GrowthMission[];
  conteudos: Conteudo[];
  workouts: HealthWorkout[];
  habits?: HealthHabit[];
  goals?: Goal[];
  orcamentos: Orcamento[];
  clientes?: Cliente[];
  gastos?: Gasto[];
  financialGoals?: FinancialGoal[];
  financialIncome?: FinancialIncome[];
}): NotificationCandidate[] {
  const {
    leads,
    eventos,
    missions,
    conteudos,
    workouts,
    habits = [],
    goals = [],
    orcamentos,
    clientes,
    gastos = [],
    financialGoals = [],
    financialIncome = [],
  } = params;
  const candidates: NotificationCandidate[] = [];
  const today = todayIsoDate();
  const tomorrow = tomorrowIsoDate();
  const nowIso = new Date().toISOString();

  for (const item of listStaleOpportunities({
    leads,
    orcamentos,
    clientes,
  })) {
    const ctx = item.context;
    const tier = ctx.idleTier;
    if (!tier) continue;

    const relatedId = item.lead?.id ?? item.orcamento?.id ?? null;
    const relatedModule = item.lead ? "crescimento" : "alvesz";

    candidates.push({
      type: "lead_followup",
      title: `Lead sem follow-up há ${ctx.idleDays} dias`,
      message: `${ctx.nome}: ${ctx.tipoEvento} · ${formatBRL(ctx.valor)} · ${ctx.statusLabel} (${getFollowUpTierLabel(tier)}).`,
      related_module: relatedModule,
      related_id: relatedId,
      scheduled_for: nowIso,
    });
  }

  for (const evento of eventos) {
    const eventDay = evento.data_inicio.slice(0, 10);

    if (eventDay === today) {
      const start = new Date(evento.data_inicio);
      const isPast = start < new Date();

      candidates.push({
        type: "event_upcoming",
        title: isPast ? "Evento em andamento" : "Evento hoje",
        message: `${formatTime(evento.data_inicio)} — ${evento.titulo}${evento.local ? ` · ${evento.local}` : ""}`,
        related_module: "calendario",
        related_id: evento.id,
        scheduled_for: evento.data_inicio,
      });
      continue;
    }

    if (eventDay === tomorrow) {
      candidates.push({
        type: "event_tomorrow",
        title: "Evento amanhã",
        message: `${formatTime(evento.data_inicio)} — ${evento.titulo}${evento.local ? ` · ${evento.local}` : ""}`,
        related_module: "calendario",
        related_id: evento.id,
        scheduled_for: evento.data_inicio,
      });
    }
  }

  for (const habit of habits) {
    if (habit.data !== today) continue;
    if (habit.status === "concluido") continue;

    candidates.push({
      type: "habit_pending",
      title: "Hábito não concluído",
      message: `Complete hoje: ${habit.titulo}.`,
      related_module: "saude",
      related_id: habit.id,
      scheduled_for: `${today}T08:00:00.000Z`,
    });
  }

  for (const goal of getActiveGoals(goals)) {
    if (!isAuraGoalBehind(goal)) continue;

    candidates.push({
      type: "goal_behind",
      title: "Meta atrasada",
      message: `"${goal.titulo}" está abaixo do ritmo esperado.`,
      related_module: null,
      related_id: goal.id,
      scheduled_for: nowIso,
    });
  }

  for (const mission of mergeDailyMissions(missions)) {
    if (mission.status !== "pending") continue;

    candidates.push({
      type: "mission_pending",
      title: "Missão pendente",
      message: `Complete hoje: ${mission.titulo} (+${mission.xp} XP).`,
      related_module: "crescimento",
      related_id: mission.recordId ?? null,
      scheduled_for: `${getTodayDate()}T09:00:00.000Z`,
    });
  }

  for (const conteudo of conteudos) {
    if (normalizeConteudoStatus(conteudo.status) === "publicado") continue;
    if (!conteudo.data_publicacao) continue;

    const due = conteudo.data_publicacao.slice(0, 10);
    if (due >= today) continue;

    candidates.push({
      type: "content_overdue",
      title: "Conteúdo atrasado",
      message: `"${conteudo.titulo}" deveria ter sido publicado em ${due} (${conteudo.plataforma}).`,
      related_module: "social-media",
      related_id: conteudo.id,
      scheduled_for: `${due}T12:00:00.000Z`,
    });
  }

  const treinoHoje = workoutForToday(workouts);
  if (treinoHoje) {
    candidates.push({
      type: "workout_planned",
      title: "Treino planejado",
      message: `${treinoHoje.nome} — ${treinoHoje.grupo_muscular} · ${treinoHoje.duracao_min} min.`,
      related_module: "saude",
      related_id: treinoHoje.id,
      scheduled_for: `${today}T07:00:00.000Z`,
    });
  }

  for (const orcamento of orcamentos) {
    const status = normalizeOrcamentoStatus(orcamento.status);
    if (status !== "enviado" && status !== "negociacao") continue;

    candidates.push({
      type: "budget_waiting",
      title: "Orçamento aguardando resposta",
      message: `${orcamento.tipo_evento} — ${formatBRL(Number(orcamento.valor_total))} · status ${status}.`,
      related_module: "alvesz",
      related_id: orcamento.id,
      scheduled_for: nowIso,
    });
  }

  const activeGoal = getActiveFinancialGoal(financialGoals, today);
  if (activeGoal) {
    if (isGoalReached(activeGoal)) {
      candidates.push({
        type: "financial_goal_reached",
        title: "Meta financeira atingida",
        message: `"${activeGoal.titulo}" — ${formatBRL(Number(activeGoal.valor_atual))} de ${formatBRL(Number(activeGoal.valor_meta))}.`,
        related_module: "financeiro",
        related_id: activeGoal.id,
        scheduled_for: nowIso,
      });
    } else if (isRevenueBelowTarget(activeGoal, financialIncome)) {
      const monthIncome = filterIncomeCurrentMonth(financialIncome).reduce(
        (sum, row) => sum + Number(row.valor),
        0
      );
      candidates.push({
        type: "revenue_below_target",
        title: "Receita abaixo da meta",
        message: `Receita do mês: ${formatBRL(monthIncome)} · meta: ${formatBRL(Number(activeGoal.valor_meta))}.`,
        related_module: "financeiro",
        related_id: activeGoal.id,
        scheduled_for: nowIso,
      });
    }
  }

  const monthGastos = filterGastosCurrentMonth(gastos);
  const totalMonth = monthGastos.reduce((s, g) => s + Number(g.valor), 0);
  const { unusual, avgPrevious } = detectUnusualExpense(gastos, totalMonth);
  if (unusual && totalMonth > 0) {
    candidates.push({
      type: "financial_expense_spike",
      title: "Despesa acima do normal",
      message: `Gastos do mês: ${formatBRL(totalMonth)} (média recente: ${formatBRL(avgPrevious)}). Revise o Financeiro.`,
      related_module: "financeiro",
      related_id: null,
      scheduled_for: nowIso,
    });
  }

  return candidates;
}

export function notificationMatchesCandidate(
  notification: Pick<Notification, "type" | "related_id" | "status" | "title">,
  candidate: NotificationCandidate
): boolean {
  if (notification.status !== "unread") return false;
  if (notification.type !== candidate.type) return false;
  if (candidate.related_id) {
    return notification.related_id === candidate.related_id;
  }
  return notification.title === candidate.title;
}

export function getUnreadPriorityNotifications(
  notifications: Notification[]
): Notification[] {
  return notifications.filter(
    (n) =>
      n.status === "unread" &&
      AURA_PRIORITY_NOTIFICATION_TYPES.includes(n.type)
  );
}

export function buildImportantNotificationsSummary(
  notifications: Notification[],
  displayName = "Anderson"
): string {
  const unread = getUnreadPriorityNotifications(notifications);

  if (unread.length === 0) {
    return `${displayName}, nada urgente nas notificações da Aura hoje. Mantenha o ritmo com finanças, hábitos e follow-ups.`;
  }

  const lines = unread.slice(0, 6).map((n) => {
    const label = NOTIFICATION_TYPE_LABELS[n.type] ?? n.type;
    return `• **${label}:** ${n.title} — ${n.message}`;
  });

  return `${displayName}, você tem **${unread.length} alerta(s) importante(s)** hoje:

${lines.join("\n")}

Abra a Central de Notificações para marcar como lidas e agir na ordem de impacto.`;
}
