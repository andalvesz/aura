import type {
  Conteudo,
  Evento,
  GrowthLead,
  GrowthMission,
  HealthWorkout,
  Notification,
  NotificationType,
  Orcamento,
} from "@/types/database";
import {
  GROWTH_LEAD_ACTIVE_STATUSES,
  mergeDailyMissions,
  getTodayDate,
} from "@/utils/growth";
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

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  lead_followup: "Lead sem follow-up",
  event_upcoming: "Evento chegando",
  mission_pending: "Missão pendente",
  content_overdue: "Conteúdo atrasado",
  workout_planned: "Treino planejado",
  budget_negotiation: "Orçamento em negociação",
};

export const NOTIFICATION_MODULE_HREFS: Record<ModuleId, string> = {
  financeiro: "/dashboard/financeiro",
  calendario: "/dashboard/calendario",
  alvesz: "/dashboard/alvesz",
  saude: "/dashboard/saude",
  "social-media": "/dashboard/social-media",
  consorcios: "/dashboard/consorcios",
  crescimento: "/dashboard/crescimento",
};

function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.max(
    0,
    Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24))
  );
}

export function getNotificationHref(notification: Notification): string {
  if (notification.related_module) {
    return NOTIFICATION_MODULE_HREFS[notification.related_module as ModuleId];
  }
  return "/dashboard/notificacoes";
}

export function buildNotificationCandidates(params: {
  leads: GrowthLead[];
  eventos: Evento[];
  missions: GrowthMission[];
  conteudos: Conteudo[];
  workouts: HealthWorkout[];
  orcamentos: Orcamento[];
}): NotificationCandidate[] {
  const { leads, eventos, missions, conteudos, workouts, orcamentos } = params;
  const candidates: NotificationCandidate[] = [];
  const today = todayIsoDate();
  const nowIso = new Date().toISOString();

  for (const lead of leads) {
    if (
      !GROWTH_LEAD_ACTIVE_STATUSES.includes(
        lead.status as (typeof GROWTH_LEAD_ACTIVE_STATUSES)[number]
      )
    ) {
      continue;
    }

    const idleDays = daysSince(lead.updated_at);
    const needsFollowUp =
      (lead.status === "proposta" && idleDays >= 5) ||
      (lead.status !== "proposta" && idleDays >= 7);

    if (!needsFollowUp) continue;

    candidates.push({
      type: "lead_followup",
      title: "Lead sem follow-up",
      message: `${lead.nome} está há ${idleDays} dias sem interação (${formatBRL(lead.valor_potencial ?? 0)} em pipeline).`,
      related_module: "crescimento",
      related_id: lead.id,
      scheduled_for: nowIso,
    });
  }

  for (const evento of eventos) {
    const eventDay = evento.data_inicio.slice(0, 10);
    if (eventDay !== today) continue;

    const start = new Date(evento.data_inicio);
    const isPast = start < new Date();

    candidates.push({
      type: "event_upcoming",
      title: isPast ? "Evento em andamento" : "Evento chegando",
      message: `${formatTime(evento.data_inicio)} — ${evento.titulo}${evento.local ? ` · ${evento.local}` : ""}`,
      related_module: "calendario",
      related_id: evento.id,
      scheduled_for: evento.data_inicio,
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
    if (orcamento.status !== "negociacao") continue;

    candidates.push({
      type: "budget_negotiation",
      title: "Orçamento em negociação",
      message: `${orcamento.tipo_evento} — ${formatBRL(Number(orcamento.valor_total))} aguardando fechamento.`,
      related_module: "alvesz",
      related_id: orcamento.id,
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
