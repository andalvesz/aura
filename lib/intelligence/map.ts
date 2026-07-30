/**
 * Map existing service DTOs → AuraIntelligenceInput.
 * Pure — no I/O.
 */

import type {
  MyDaySummary,
} from "@/lib/supabase/services/my-day.service";
import type { WorkspaceDashboardSummary } from "@/lib/supabase/services/workspace-dashboard.service";
import type {
  AuraIntelligenceInput,
  PersonalIntelligenceDTO,
  WorkspaceIntelligenceDTO,
} from "@/lib/intelligence/types";
import { todayIsoDate } from "@/utils/health";

export function emptyPersonalDTO(): PersonalIntelligenceDTO {
  return {
    agenda: { today: [], overdue: [], next7Days: [], timedEvents: [] },
    habits: {
      pending: [],
      completedToday: [],
      streakDays: 0,
      dailyProgressPct: 0,
    },
    health: {
      workoutToday: false,
      workoutName: null,
      mealsToday: 0,
      daysSinceLastWorkout: null,
    },
    finance: {
      saldoAtual: null,
      hasSaldo: false,
      gastoHoje: 0,
      gastoMes: 0,
      receitaMes: 0,
      orcamentoPct: null,
      orcamentoRestante: null,
      budgetAlert: false,
      topCategory: null,
    },
    goals: { activeCount: 0, items: [] },
    travel: { trip: null },
    language: {
      configured: false,
      practicedToday: false,
      streak: 0,
      modoLabel: null,
    },
    expertBrain: {
      documents: 0,
      pending: 0,
      processing: 0,
      errors: 0,
      lastActivityAt: null,
    },
  };
}

export function mapMyDayToPersonalDTO(
  summary: MyDaySummary,
  extras?: {
    timedEvents?: PersonalIntelligenceDTO["agenda"]["timedEvents"];
    daysSinceLastWorkout?: number | null;
    topCategory?: { key: string; total: number } | null;
    goalItems?: PersonalIntelligenceDTO["goals"]["items"];
  }
): PersonalIntelligenceDTO {
  const base = emptyPersonalDTO();
  const agenda = summary.agenda.data;
  const habits = summary.habits.data;
  const health = summary.health.data;
  const finance = summary.finance.data;
  const goals = summary.goals.data;
  const travel = summary.travel.data;
  const language = summary.language.data;
  const expert = summary.expertBrain.data;

  return {
    agenda: {
      today: (agenda?.today ?? []).map((e) => ({
        id: e.id,
        titulo: e.titulo,
      })),
      overdue: agenda?.overdue ?? [],
      next7Days: agenda?.next7Days ?? [],
      timedEvents: extras?.timedEvents ?? agenda?.timedEvents ?? [],
    },
    habits: {
      pending: habits?.pending ?? [],
      completedToday: habits?.completedToday ?? [],
      streakDays: habits?.streakDays ?? 0,
      dailyProgressPct: habits?.dailyProgressPct ?? 0,
    },
    health: {
      workoutToday: Boolean(health?.workout),
      workoutName: health?.workout?.nome ?? null,
      mealsToday: health?.meals.length ?? 0,
      daysSinceLastWorkout:
        extras?.daysSinceLastWorkout !== undefined
          ? extras.daysSinceLastWorkout
          : health?.workout
            ? 0
            : null,
    },
    finance: {
      saldoAtual: finance?.saldoAtual ?? null,
      hasSaldo: finance?.hasSaldo ?? false,
      gastoHoje: finance?.gastoHoje ?? 0,
      gastoMes: finance?.gastoMes ?? 0,
      receitaMes: finance?.receitaMes ?? 0,
      orcamentoPct: finance?.orcamentoPct ?? null,
      orcamentoRestante: finance?.orcamentoRestante ?? null,
      budgetAlert: finance?.budgetAlert ?? false,
      topCategory: extras?.topCategory ?? null,
    },
    goals: {
      activeCount: goals?.activeCount ?? 0,
      items:
        extras?.goalItems ??
        (goals?.priority
          ? [
              {
                id: goals.priority.id,
                titulo: goals.priority.titulo,
                prazo: goals.priority.prazo,
                remainingDays: goals.priority.remainingDays,
                atual: goals.priority.atual,
                meta: goals.priority.meta,
              },
            ]
          : []),
    },
    travel: {
      trip: travel?.trip
        ? {
            id: travel.trip.id,
            titulo: travel.trip.titulo,
            daysRemaining: travel.trip.daysRemaining,
            checklistPct: travel.trip.checklistPct,
            nextChecklist: travel.trip.nextChecklist,
          }
        : null,
    },
    language: {
      configured: Boolean(language?.progress),
      practicedToday: language?.practicedToday ?? false,
      streak: language?.progress?.streak ?? 0,
      modoLabel: language?.progress?.modoLabel ?? null,
    },
    expertBrain: {
      documents: expert?.documents ?? 0,
      pending: expert?.pending ?? 0,
      processing: expert?.processing ?? 0,
      errors: expert?.errors ?? 0,
      lastActivityAt: expert?.lastActivityAt ?? null,
    },
  };
}

export function mapWorkspaceToDTO(
  summary: WorkspaceDashboardSummary
): WorkspaceIntelligenceDTO {
  const ops = summary.ops.data;
  const commercial = summary.commercial.data;
  const crm = summary.crm.data;
  const alvesz = summary.alvesz.data;
  const team = summary.team.data;

  return {
    workspaceId: summary.workspaceId,
    workspaceName: ops?.workspaceName ?? "Workspace",
    role: summary.role,
    openPropostas: commercial?.openPropostas ?? ops?.openPropostas ?? 0,
    followUpsPending: crm?.followUpsPending ?? 0,
    estoqueAlerts: alvesz?.estoqueAlerts.length ?? 0,
    pendingInvites: team?.pendingInvites ?? 0,
    upcomingEvents: alvesz?.upcomingEvents.length ?? ops?.upcomingEvents.length ?? 0,
    alerts: ops?.alerts ?? [],
  };
}

export function buildPersonalIntelligenceInput(params: {
  userId: string;
  asOf?: string;
  personal: PersonalIntelligenceDTO;
}): AuraIntelligenceInput {
  return {
    userId: params.userId,
    context: "personal",
    asOf: params.asOf ?? todayIsoDate(),
    personal: params.personal,
    workspace: null,
  };
}

export function buildWorkspaceIntelligenceInput(params: {
  userId: string;
  asOf?: string;
  workspace: WorkspaceIntelligenceDTO;
}): AuraIntelligenceInput {
  return {
    userId: params.userId,
    context: "workspace",
    asOf: params.asOf ?? todayIsoDate(),
    personal: null,
    workspace: params.workspace,
  };
}
