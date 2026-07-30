import { BaseRepository } from "@/lib/supabase/repositories/base.repository";
import { getDataContext } from "@/lib/supabase/services/context";
import { loadSmartFinanceDashboard } from "@/lib/supabase/services/finance.service";
import { listGoals } from "@/lib/supabase/services/goals.service";
import { getExpertBrainDashboard } from "@/lib/supabase/services/expert-brain-dashboard.service";
import { listTrips, listTripChecklist } from "@/lib/supabase/services/travel.service";
import { getGoogleCalendarPublicStatus } from "@/lib/google-calendar";
import { isSameLocalDay } from "@/lib/dashboard/context-dashboard";
import {
  prioritizeMyDay,
  summarizeDayNarrative,
  type MyDayPriorityItem,
} from "@/lib/supabase/services/my-day-priority.service";
import {
  daysUntilTrip,
  upcomingTrip,
  computeChecklistProgress,
} from "@/utils/travel";
import { formatCountdown } from "@/utils/disney-nba";
import {
  getExecutiveGreeting,
  formatExecutiveDateLabel,
} from "@/utils/executive";
import { ENGLISH_MODOS } from "@/utils/english";
import type {
  Evento,
  Gasto,
  Goal,
  HealthHabit,
  HealthMeal,
  HealthSession,
  HealthWorkout,
  LanguageProgress,
  LanguageSession,
  TripChecklistItem,
} from "@/types/database";
import {
  getActiveGoals,
  formatGoalProgress,
  isGoalBehind,
  findMostDelayedGoal,
} from "@/utils/goals";
import {
  mealsForToday,
  todayIsoDate,
  workoutForToday,
} from "@/utils/health";

export type MyDayBlockStatus = "ok" | "empty" | "error" | "loading";

export type MyDayBlock<T> = {
  status: MyDayBlockStatus;
  data: T | null;
  error: string | null;
};

function ok<T>(data: T, empty: boolean): MyDayBlock<T> {
  return empty
    ? { status: "empty", data, error: null }
    : { status: "ok", data, error: null };
}

function err<T>(message: string): MyDayBlock<T> {
  return { status: "error", data: null, error: message };
}

export type MyDayAgenda = {
  today: { id: string; titulo: string; local: string | null }[];
  upcoming: { id: string; titulo: string; data: string; local: string | null }[];
  next7Days: { id: string; titulo: string; data: string }[];
  overdue: { id: string; titulo: string; data: string }[];
  /** Timed events (ISO) for conflict detection — excludes pure date-only when possible */
  timedEvents: {
    id: string;
    titulo: string;
    start: string;
    end: string | null;
  }[];
  google: {
    status: "connected" | "disconnected" | "error";
    email: string | null;
    configured: boolean;
  };
};

export type MyDayHabits = {
  pending: { id: string; titulo: string; data: string }[];
  completedToday: { id: string; titulo: string }[];
  streakDays: number;
  dailyProgressPct: number;
};

export type MyDayHealth = {
  workout: { id: string; nome: string; duracaoMin: number } | null;
  meals: { id: string; nome: string; horario: string }[];
  waterAvailable: false;
  waterNote: string;
  leitura: { id: string; titulo: string } | null;
  meditacao: { id: string; titulo: string } | null;
};

export type MyDayFinance = {
  saldoAtual: number | null;
  hasSaldo: boolean;
  gastoHoje: number;
  gastoMes: number;
  receitaMes: number;
  orcamentoRestante: number | null;
  orcamentoPct: number | null;
  budgetAlert: boolean;
};

export type MyDayGoals = {
  priority: {
    id: string;
    titulo: string;
    progressLabel: string;
    prazo: string;
    remainingDays: number;
    atual: number;
    meta: number;
  } | null;
  activeCount: number;
};

export type MyDayTravel = {
  trip: {
    id: string;
    titulo: string;
    daysRemaining: number;
    countdownLabel: string;
    checklistPct: number;
    nextChecklist: string | null;
  } | null;
};

export type MyDayLanguage = {
  progress: {
    modo: string;
    modoLabel: string;
    streak: number;
    nivel: string | null;
  } | null;
  nextSession: { id: string; titulo: string; status: string } | null;
  practicedToday: boolean;
};

export type MyDayExpert = {
  documents: number;
  pending: number;
  processing: number;
  errors: number;
  lastActivityAt: string | null;
};

export type MyDaySummary = {
  greeting: string;
  dateLabel: string;
  narrative: string;
  priorities: MyDayPriorityItem[];
  agenda: MyDayBlock<MyDayAgenda>;
  habits: MyDayBlock<MyDayHabits>;
  health: MyDayBlock<MyDayHealth>;
  finance: MyDayBlock<MyDayFinance>;
  goals: MyDayBlock<MyDayGoals>;
  travel: MyDayBlock<MyDayTravel>;
  language: MyDayBlock<MyDayLanguage>;
  expertBrain: MyDayBlock<MyDayExpert>;
  loadedAt: string;
  loadMs: number;
};

function daysBetween(iso: string, ref = todayIsoDate()): number {
  const a = new Date(`${iso.slice(0, 10)}T12:00:00`);
  const b = new Date(`${ref}T12:00:00`);
  return Math.ceil((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function computeHabitStreak(habits: HealthHabit[], today = todayIsoDate()): number {
  const doneDates = new Set(
    habits.filter((h) => h.status === "concluido").map((h) => h.data.slice(0, 10))
  );
  let streak = 0;
  const cursor = new Date(`${today}T12:00:00`);
  for (let i = 0; i < 60; i++) {
    const iso = cursor.toISOString().slice(0, 10);
    if (doneDates.has(iso)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    if (i === 0) return 0;
    break;
  }
  return streak;
}

/**
 * Single server aggregation for "Meu Dia" — authenticated user only.
 * One parallel batch; no mocks; blocks fail independently.
 */
export async function getMyDaySummary(displayName?: string): Promise<MyDaySummary> {
  const started = Date.now();
  const { supabase, userId } = await getDataContext();
  const today = todayIsoDate();
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Iso = in7.toISOString().slice(0, 10);

  const [
    eventosRes,
    habitsRes,
    workoutsRes,
    mealsRes,
    sessionsRes,
    gastosRes,
    goalsRes,
    tripsRes,
    langProgressRes,
    langSessionsRes,
    financeRes,
    expertRes,
    googleRes,
  ] = await Promise.all([
    new BaseRepository(supabase, "eventos", userId).findAll("data_inicio"),
    new BaseRepository(supabase, "health_habits", userId).findAll("data"),
    new BaseRepository(supabase, "health_workouts", userId).findAll("data"),
    new BaseRepository(supabase, "health_meals", userId).findAll("data"),
    new BaseRepository(supabase, "health_sessions", userId).findAll("data"),
    new BaseRepository(supabase, "gastos", userId).findAll("data"),
    listGoals(),
    listTrips(),
    supabase
      .from("language_progress")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("language_sessions")
      .select("id, titulo, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    loadSmartFinanceDashboard().catch((e) => ({
      stats: null,
      error: e instanceof Error ? e.message : "Erro financeiro",
    })),
    getExpertBrainDashboard().catch((e) => ({
      dashboard: null,
      error: e instanceof Error ? e.message : "Erro Expert Brain",
      warnings: [],
    })),
    getGoogleCalendarPublicStatus().catch(() => null),
  ]);

  const eventos = (eventosRes.data ?? []) as Evento[];
  const habits = (habitsRes.data ?? []) as HealthHabit[];
  const workouts = (workoutsRes.data ?? []) as HealthWorkout[];
  const meals = (mealsRes.data ?? []) as HealthMeal[];
  const sessions = (sessionsRes.data ?? []) as HealthSession[];
  const gastos = (gastosRes.data ?? []) as Gasto[];
  const goals = (goalsRes.goals ?? []) as Goal[];

  // --- Agenda ---
  let agenda: MyDayBlock<MyDayAgenda>;
  try {
    if (eventosRes.error) {
      agenda = err(eventosRes.error);
    } else {
      const todayEvents = eventos
        .filter((e) => isSameLocalDay(e.data_inicio))
        .map((e) => ({ id: e.id, titulo: e.titulo, local: e.local }));
      const overdue = eventos
        .filter((e) => e.data_inicio.slice(0, 10) < today)
        .slice(0, 8)
        .map((e) => ({
          id: e.id,
          titulo: e.titulo,
          data: e.data_inicio.slice(0, 10),
        }));
      const upcoming = eventos
        .filter((e) => e.data_inicio.slice(0, 10) > today)
        .slice(0, 8)
        .map((e) => ({
          id: e.id,
          titulo: e.titulo,
          data: e.data_inicio.slice(0, 10),
          local: e.local,
        }));
      const next7Days = eventos
        .filter((e) => {
          const d = e.data_inicio.slice(0, 10);
          return d > today && d <= in7Iso;
        })
        .map((e) => ({
          id: e.id,
          titulo: e.titulo,
          data: e.data_inicio.slice(0, 10),
        }));

      let googleStatus: MyDayAgenda["google"]["status"] = "disconnected";
      let email: string | null = null;
      let configured = false;
      if (googleRes === null) {
        googleStatus = "error";
      } else {
        configured = googleRes.configured;
        email = googleRes.email;
        googleStatus = googleRes.connected ? "connected" : "disconnected";
      }

      const timedEvents = eventos
        .filter((e) => {
          const d = e.data_inicio.slice(0, 10);
          return d >= today && d <= in7Iso;
        })
        .map((e) => ({
          id: e.id,
          titulo: e.titulo,
          start: e.data_inicio,
          end: e.data_fim,
        }));

      const data: MyDayAgenda = {
        today: todayEvents,
        upcoming,
        next7Days,
        overdue,
        timedEvents,
        google: { status: googleStatus, email, configured },
      };
      agenda = ok(
        data,
        todayEvents.length === 0 &&
          upcoming.length === 0 &&
          overdue.length === 0
      );
    }
  } catch (e) {
    agenda = err(e instanceof Error ? e.message : "Erro na agenda");
  }

  // --- Habits ---
  let habitsBlock: MyDayBlock<MyDayHabits>;
  try {
    if (habitsRes.error) {
      habitsBlock = err(habitsRes.error);
    } else {
      const pending = habits
        .filter(
          (h) =>
            h.status !== "concluido" &&
            (h.data.slice(0, 10) <= today || h.status === "ativo")
        )
        .slice(0, 12)
        .map((h) => ({ id: h.id, titulo: h.titulo, data: h.data.slice(0, 10) }));
      const completedToday = habits
        .filter((h) => h.status === "concluido" && h.data.slice(0, 10) === today)
        .map((h) => ({ id: h.id, titulo: h.titulo }));
      const totalTodayRelevant = pending.length + completedToday.length;
      const dailyProgressPct =
        totalTodayRelevant === 0
          ? 0
          : Math.round((completedToday.length / totalTodayRelevant) * 100);
      const data: MyDayHabits = {
        pending,
        completedToday,
        streakDays: computeHabitStreak(habits, today),
        dailyProgressPct,
      };
      habitsBlock = ok(
        data,
        pending.length === 0 && completedToday.length === 0 && habits.length === 0
      );
    }
  } catch (e) {
    habitsBlock = err(e instanceof Error ? e.message : "Erro hábitos");
  }

  // --- Health ---
  let health: MyDayBlock<MyDayHealth>;
  try {
    const w = workoutForToday(workouts);
    const todayWorkout =
      w && isSameLocalDay(w.data)
        ? { id: w.id, nome: w.nome, duracaoMin: w.duracao_min }
        : null;
    const todayMeals = mealsForToday(meals).map((m) => ({
      id: m.id,
      nome: m.nome,
      horario: m.horario,
    }));
    const leitura =
      sessions.find((s) => s.tipo === "leitura" && isSameLocalDay(s.data)) ??
      sessions.find((s) => s.tipo === "leitura") ??
      null;
    const meditacao =
      sessions.find((s) => s.tipo === "meditacao" && isSameLocalDay(s.data)) ??
      sessions.find((s) => s.tipo === "meditacao") ??
      null;
    const data: MyDayHealth = {
      workout: todayWorkout,
      meals: todayMeals,
      waterAvailable: false,
      waterNote: "Registro de água ainda não está disponível neste módulo.",
      leitura: leitura ? { id: leitura.id, titulo: leitura.titulo } : null,
      meditacao: meditacao
        ? { id: meditacao.id, titulo: meditacao.titulo }
        : null,
    };
    health = ok(
      data,
      !todayWorkout &&
        todayMeals.length === 0 &&
        !leitura &&
        !meditacao
    );
  } catch (e) {
    health = err(e instanceof Error ? e.message : "Erro saúde");
  }

  // --- Finance ---
  let finance: MyDayBlock<MyDayFinance>;
  try {
    if (financeRes.error || !financeRes.stats) {
      finance = financeRes.error
        ? err(financeRes.error)
        : ok(
            {
              saldoAtual: null,
              hasSaldo: false,
              gastoHoje: 0,
              gastoMes: 0,
              receitaMes: 0,
              orcamentoRestante: null,
              orcamentoPct: null,
              budgetAlert: false,
            },
            true
          );
    } else {
      const stats = financeRes.stats;
      const gastoHoje = gastos
        .filter((g) => g.data.slice(0, 10) === today)
        .reduce((s, g) => s + Number(g.valor), 0);
      const remaining =
        stats.goalProgress != null
          ? Math.max(0, stats.goalProgress.remaining)
          : null;
      const data: MyDayFinance = {
        saldoAtual: stats.saldoAtual,
        hasSaldo: stats.hasInitialBalance,
        gastoHoje,
        gastoMes: stats.totalMonth,
        receitaMes: stats.totalIncomeMonth,
        orcamentoRestante: remaining,
        orcamentoPct: stats.goalProgress?.pct ?? null,
        budgetAlert:
          Boolean(stats.expenseAlert?.unusual) ||
          Boolean(
            stats.goalProgress &&
              stats.goalProgress.pct >= 80 &&
              stats.goalProgress.pct < 100
          ),
      };
      finance = ok(
        data,
        !data.hasSaldo &&
          data.gastoHoje === 0 &&
          data.gastoMes === 0 &&
          data.receitaMes === 0
      );
    }
  } catch (e) {
    finance = err(e instanceof Error ? e.message : "Erro financeiro");
  }

  // --- Goals ---
  let goalsBlock: MyDayBlock<MyDayGoals>;
  try {
    if (goalsRes.error) {
      goalsBlock = err(goalsRes.error);
    } else {
      const active = getActiveGoals(goals);
      const delayed = findMostDelayedGoal(goals);
      const pick =
        delayed ??
        [...active].sort((a, b) => a.data_fim.localeCompare(b.data_fim))[0] ??
        null;
      const priority = pick
        ? {
            id: pick.id,
            titulo: pick.titulo,
            progressLabel: formatGoalProgress(pick),
            prazo: pick.data_fim,
            remainingDays: Math.max(0, daysBetween(pick.data_fim, today)),
            atual: Number(pick.atual),
            meta: Number(pick.meta),
          }
        : null;
      goalsBlock = ok(
        { priority, activeCount: active.length },
        active.length === 0
      );
    }
  } catch (e) {
    goalsBlock = err(e instanceof Error ? e.message : "Erro objetivos");
  }

  // --- Travel ---
  let travel: MyDayBlock<MyDayTravel>;
  try {
    if (tripsRes.error) {
      travel = err(tripsRes.error);
    } else {
      const trip = upcomingTrip(tripsRes.trips);
      if (!trip) {
        travel = ok({ trip: null }, true);
      } else {
        const { items } = await listTripChecklist(trip.id);
        const checklist = (items ?? []) as TripChecklistItem[];
        const nextItem =
          checklist.find((i) => i.status !== "feito")?.titulo ?? null;
        const days = daysUntilTrip(trip);
        travel = ok(
          {
            trip: {
              id: trip.id,
              titulo: trip.nome,
              daysRemaining: days,
              countdownLabel: formatCountdown(days),
              checklistPct: computeChecklistProgress(checklist),
              nextChecklist: nextItem,
            },
          },
          false
        );
      }
    }
  } catch (e) {
    travel = err(e instanceof Error ? e.message : "Erro viagens");
  }

  // --- Language ---
  let language: MyDayBlock<MyDayLanguage>;
  try {
    if (langProgressRes.error) {
      language = err(langProgressRes.error.message);
    } else {
      const progress = langProgressRes.data as LanguageProgress | null;
      const sessionsList = (langSessionsRes.data ?? []) as Pick<
        LanguageSession,
        "id" | "titulo" | "status" | "created_at"
      >[];
      const nextSession =
        sessionsList.find((s) => s.status === "em_andamento") ??
        sessionsList[0] ??
        null;
      const practicedToday = progress?.ultima_pratica === today;
      const modo = progress?.modo_favorito ?? null;
      const modoLabel =
        ENGLISH_MODOS.find((m) => m.id === modo)?.label ?? modo ?? "Inglês";
      language = ok(
        {
          progress: progress
            ? {
                modo: modo ?? "conversacao_livre",
                modoLabel,
                streak: Number(progress.streak_dias ?? 0),
                nivel: progress.nivel ?? null,
              }
            : null,
          nextSession: nextSession
            ? {
                id: nextSession.id,
                titulo: nextSession.titulo,
                status: nextSession.status,
              }
            : null,
          practicedToday,
        },
        !progress && !nextSession
      );
    }
  } catch (e) {
    language = err(e instanceof Error ? e.message : "Erro idiomas");
  }

  // --- Expert Brain ---
  let expertBrain: MyDayBlock<MyDayExpert>;
  try {
    if (expertRes.error || !expertRes.dashboard) {
      expertBrain = err(expertRes.error ?? "Expert Brain indisponível");
    } else {
      const d = expertRes.dashboard;
      const data: MyDayExpert = {
        documents:
          d.metrics.sourcesReady + d.metrics.lessons + d.metrics.frameworks,
        pending: d.metrics.queuePending,
        processing: d.metrics.queueProcessing,
        errors: d.ingestionBuckets?.failed ?? 0,
        lastActivityAt:
          d.ingestionQueue?.[0]?.updated_at ??
          d.ingestionQueue?.[0]?.created_at ??
          null,
      };
      expertBrain = ok(
        data,
        data.documents === 0 &&
          data.pending === 0 &&
          data.processing === 0 &&
          data.errors === 0
      );
    }
  } catch (e) {
    expertBrain = err(e instanceof Error ? e.message : "Erro Expert Brain");
  }

  // --- Priorities ---
  const overdueHabits = (habitsBlock.data?.pending ?? []).filter(
    (h) => h.data < today
  );
  const nearGoals = getActiveGoals(goals)
    .map((g) => ({
      id: g.id,
      titulo: g.titulo,
      prazo: g.data_fim,
      remainingDays: Math.max(0, daysBetween(g.data_fim, today)),
      behind: isGoalBehind(g),
    }))
    .filter((g) => g.remainingDays <= 7 || g.behind)
    .map(({ behind: _b, ...rest }) => rest);

  const priorities = prioritizeMyDay({
    overdueEvents: (agenda.data?.overdue ?? []).map((e) => ({
      id: e.id,
      titulo: e.titulo,
    })),
    overdueHabits,
    pendingHabits: (habitsBlock.data?.pending ?? [])
      .filter((h) => h.data >= today)
      .slice(0, 5),
    budgetCritical: Boolean(finance.data?.budgetAlert),
    budgetDetail:
      finance.data?.orcamentoPct != null
        ? `${finance.data.orcamentoPct}% do orçamento usado`
        : null,
    nearGoals,
    workoutPending: !health.data?.workout,
    tripSoon: travel.data?.trip
      ? {
          id: travel.data.trip.id,
          titulo: travel.data.trip.titulo,
          daysRemaining: travel.data.trip.daysRemaining,
        }
      : null,
    expertErrors: expertBrain.data?.errors ?? 0,
    todayEvents: (agenda.data?.today ?? []).map((e) => ({
      id: e.id,
      titulo: e.titulo,
    })),
    languageDue: Boolean(
      language.data && !language.data.practicedToday && language.data.progress
    ),
  });

  const narrative = summarizeDayNarrative({
    priorityCount: priorities.filter((p) => p.priority === "ALTA").length,
    todayEvents: agenda.data?.today.length ?? 0,
    pendingHabits: habitsBlock.data?.pending.length ?? 0,
    hasWorkout: Boolean(health.data?.workout),
  });

  const name = displayName?.trim() || "você";

  return {
    greeting: getExecutiveGreeting(name),
    dateLabel: formatExecutiveDateLabel(),
    narrative,
    priorities: priorities.slice(0, 12),
    agenda,
    habits: habitsBlock,
    health,
    finance,
    goals: goalsBlock,
    travel,
    language,
    expertBrain,
    loadedAt: new Date().toISOString(),
    loadMs: Date.now() - started,
  };
}
