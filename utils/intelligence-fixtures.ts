/**
 * Fixtures for Aura Intelligence Engine unit tests.
 */

import {
  buildPersonalIntelligenceInput,
  buildWorkspaceIntelligenceInput,
  emptyPersonalDTO,
} from "@/lib/intelligence/map";
import type {
  AuraIntelligenceInput,
  PersonalIntelligenceDTO,
  WorkspaceIntelligenceDTO,
} from "@/lib/intelligence/types";

const AS_OF = "2026-07-28";
const USER = "user-test-1";

export function personalInput(
  personal: PersonalIntelligenceDTO,
  asOf = AS_OF
): AuraIntelligenceInput {
  return buildPersonalIntelligenceInput({
    userId: USER,
    asOf,
    personal,
  });
}

export function emptyUserInput(): AuraIntelligenceInput {
  return personalInput(emptyPersonalDTO());
}

export function healthyUserInput(): AuraIntelligenceInput {
  const p = emptyPersonalDTO();
  p.habits = {
    pending: [],
    completedToday: [{ id: "h1", titulo: "Água" }],
    streakDays: 5,
    dailyProgressPct: 100,
  };
  p.health = {
    workoutToday: true,
    workoutName: "Full body",
    mealsToday: 3,
    daysSinceLastWorkout: 0,
  };
  p.finance = {
    saldoAtual: 5000,
    hasSaldo: true,
    gastoHoje: 40,
    gastoMes: 800,
    receitaMes: 4000,
    orcamentoPct: 40,
    orcamentoRestante: 1200,
    budgetAlert: false,
    topCategory: { key: "alimentacao", total: 300 },
  };
  p.goals = {
    activeCount: 1,
    items: [
      {
        id: "g1",
        titulo: "Reserva",
        prazo: "2026-12-01",
        remainingDays: 120,
        atual: 50,
        meta: 100,
      },
    ],
  };
  p.language = {
    configured: true,
    practicedToday: true,
    streak: 4,
    modoLabel: "Conversação",
  };
  p.expertBrain = {
    documents: 12,
    pending: 0,
    processing: 0,
    errors: 0,
    lastActivityAt: "2026-07-28T10:00:00Z",
  };
  p.agenda = {
    today: [{ id: "e1", titulo: "Standup" }],
    overdue: [],
    next7Days: [{ id: "e2", titulo: "Review", data: "2026-07-30" }],
    timedEvents: [],
  };
  return personalInput(p);
}

export function financeCriticalInput(): AuraIntelligenceInput {
  const p = emptyPersonalDTO();
  p.finance = {
    saldoAtual: 100,
    hasSaldo: true,
    gastoHoje: 200,
    gastoMes: 5000,
    receitaMes: 3000,
    orcamentoPct: 105,
    orcamentoRestante: 0,
    budgetAlert: true,
    topCategory: { key: "lazer", total: 2000 },
  };
  return personalInput(p);
}

export function habitsOverdueInput(): AuraIntelligenceInput {
  const p = emptyPersonalDTO();
  p.habits = {
    pending: [
      { id: "h1", titulo: "Meditar", data: "2026-07-25" },
      { id: "h2", titulo: "Ler", data: "2026-07-26" },
    ],
    completedToday: [],
    streakDays: 0,
    dailyProgressPct: 0,
  };
  return personalInput(p);
}

export function goalsNearInput(): AuraIntelligenceInput {
  const p = emptyPersonalDTO();
  p.goals = {
    activeCount: 2,
    items: [
      {
        id: "g1",
        titulo: "Meta crítica",
        prazo: "2026-07-29",
        remainingDays: 1,
        atual: 10,
        meta: 100,
        behind: true,
      },
      {
        id: "g2",
        titulo: "Meta semana",
        prazo: "2026-08-02",
        remainingDays: 5,
        atual: 40,
        meta: 100,
      },
    ],
  };
  return personalInput(p);
}

export function tripSoonInput(): AuraIntelligenceInput {
  const p = emptyPersonalDTO();
  p.travel = {
    trip: {
      id: "t1",
      titulo: "Disney",
      daysRemaining: 5,
      checklistPct: 40,
      nextChecklist: "Passaporte",
    },
  };
  return personalInput(p);
}

export function expertBrainStuckInput(): AuraIntelligenceInput {
  const p = emptyPersonalDTO();
  p.expertBrain = {
    documents: 3,
    pending: 5,
    processing: 0,
    errors: 2,
    lastActivityAt: "2026-07-20T10:00:00Z",
  };
  return personalInput(p);
}

export function multiAlertInput(): AuraIntelligenceInput {
  const p = emptyPersonalDTO();
  p.finance = {
    ...emptyPersonalDTO().finance,
    hasSaldo: true,
    gastoMes: 4000,
    orcamentoPct: 95,
    budgetAlert: true,
  };
  p.habits = {
    pending: [{ id: "h1", titulo: "Água", data: "2026-07-20" }],
    completedToday: [],
    streakDays: 0,
    dailyProgressPct: 0,
  };
  p.agenda = {
    today: [],
    overdue: [{ id: "e1", titulo: "Reunião antiga", data: "2026-07-20" }],
    next7Days: [],
    timedEvents: [],
  };
  p.health = {
    workoutToday: false,
    workoutName: null,
    mealsToday: 1,
    daysSinceLastWorkout: 4,
  };
  p.expertBrain = {
    documents: 1,
    pending: 3,
    processing: 0,
    errors: 1,
    lastActivityAt: null,
  };
  return personalInput(p);
}

export function calendarConflictInput(): AuraIntelligenceInput {
  const p = emptyPersonalDTO();
  p.agenda = {
    today: [
      { id: "a", titulo: "Call A" },
      { id: "b", titulo: "Call B" },
    ],
    overdue: [],
    next7Days: [],
    timedEvents: [
      {
        id: "a",
        titulo: "Call A",
        start: "2026-07-28T10:00:00",
        end: "2026-07-28T11:00:00",
      },
      {
        id: "b",
        titulo: "Call B",
        start: "2026-07-28T10:30:00",
        end: "2026-07-28T11:30:00",
      },
    ],
  };
  return personalInput(p);
}

export function workspaceInput(
  partial?: Partial<WorkspaceIntelligenceDTO>
): AuraIntelligenceInput {
  const workspace: WorkspaceIntelligenceDTO = {
    workspaceId: "ws-1",
    workspaceName: "Alvesz",
    role: "owner",
    openPropostas: 2,
    followUpsPending: 3,
    estoqueAlerts: 1,
    pendingInvites: 0,
    upcomingEvents: 2,
    alerts: ["Estoque baixo"],
    ...partial,
  };
  return buildWorkspaceIntelligenceInput({
    userId: USER,
    asOf: AS_OF,
    workspace,
  });
}
