import { BaseRepository } from "@/lib/supabase/repositories/base.repository";
import { getDataContext } from "@/lib/supabase/services/context";
import { loadSmartFinanceDashboard } from "@/lib/supabase/services/finance.service";
import { listGoals } from "@/lib/supabase/services/goals.service";
import { getExpertBrainDashboard } from "@/lib/supabase/services/expert-brain-dashboard.service";
import { isGoogleCalendarConnected } from "@/lib/google-calendar";
import { isSameLocalDay } from "@/lib/dashboard/context-dashboard";
import { getActiveGoals, formatGoalProgress, isGoalReached } from "@/utils/goals";
import type {
  Evento,
  Goal,
  HealthHabit,
  HealthSession,
  HealthWorkout,
} from "@/types/database";

export type DashboardBlockStatus = "ok" | "empty" | "error" | "loading";

export type DashboardBlock<T> = {
  status: DashboardBlockStatus;
  data: T | null;
  error: string | null;
};

function okBlock<T>(data: T, isEmpty: boolean): DashboardBlock<T> {
  if (isEmpty) return { status: "empty", data, error: null };
  return { status: "ok", data, error: null };
}

function errBlock<T>(error: string): DashboardBlock<T> {
  return { status: "error", data: null, error };
}

export type PersonalDayItem = {
  id: string;
  title: string;
  kind: "evento" | "objetivo" | "habito" | "treino" | "lembrete";
  meta?: string | null;
};

export type PersonalFinanceSummary = {
  saldoAtual: number | null;
  hasSaldo: boolean;
  receitasMes: number;
  despesasMes: number;
  orcamentoMeta: number | null;
  orcamentoPct: number | null;
  budgetAlert: boolean;
  recentTransactions: {
    id: string;
    label: string;
    amount: number;
    kind: "receita" | "despesa";
    date: string;
  }[];
};

export type PersonalHealthSummary = {
  workoutToday: { id: string; nome: string; duracaoMin: number } | null;
  pendingHabits: { id: string; titulo: string }[];
  leituraRecent: { id: string; titulo: string; data: string } | null;
  meditacaoRecent: { id: string; titulo: string; data: string } | null;
  workoutsThisWeek: number;
  habitsDoneThisWeek: number;
};

export type PersonalGoalsSummary = {
  active: { id: string; titulo: string; progressLabel: string; prazo: string | null }[];
  nearDeadline: { id: string; titulo: string; prazo: string }[];
  recentlyCompleted: { id: string; titulo: string }[];
};

export type PersonalCalendarSummary = {
  today: { id: string; titulo: string; local: string | null }[];
  upcoming: { id: string; titulo: string; data: string; local: string | null }[];
  googleConnected: boolean;
};

export type PersonalExpertBrainSummary = {
  contents: number;
  pending: number;
  processing: number;
  errors: number;
  lastActivityAt: string | null;
};

export type PersonalDashboardSummary = {
  mode: "personal";
  day: DashboardBlock<{ items: PersonalDayItem[] }>;
  finance: DashboardBlock<PersonalFinanceSummary>;
  health: DashboardBlock<PersonalHealthSummary>;
  goals: DashboardBlock<PersonalGoalsSummary>;
  calendar: DashboardBlock<PersonalCalendarSummary>;
  expertBrain: DashboardBlock<PersonalExpertBrainSummary>;
};

async function loadDayBlock(
  eventos: Evento[],
  goals: Goal[],
  habits: HealthHabit[],
  workouts: HealthWorkout[]
): Promise<DashboardBlock<{ items: PersonalDayItem[] }>> {
  try {
    const items: PersonalDayItem[] = [];
    for (const e of eventos) {
      if (isSameLocalDay(e.data_inicio)) {
        items.push({
          id: e.id,
          title: e.titulo,
          kind: "evento",
          meta: e.local,
        });
      }
    }
    for (const g of getActiveGoals(goals).slice(0, 5)) {
      items.push({
        id: g.id,
        title: g.titulo,
        kind: "objetivo",
        meta: formatGoalProgress(g),
      });
    }
    for (const h of habits) {
      if (h.status !== "concluido" && (isSameLocalDay(h.data) || !h.data)) {
        items.push({ id: h.id, title: h.titulo, kind: "habito" });
      }
    }
    const workout = workouts.find((w) => isSameLocalDay(w.data));
    if (workout) {
      items.push({
        id: workout.id,
        title: workout.nome,
        kind: "treino",
        meta: `${workout.duracao_min} min`,
      });
    }
    return okBlock({ items: items.slice(0, 12) }, items.length === 0);
  } catch (e) {
    return errBlock(e instanceof Error ? e.message : "Erro no resumo do dia");
  }
}

async function loadFinanceBlock(): Promise<DashboardBlock<PersonalFinanceSummary>> {
  try {
    const { stats, error } = await loadSmartFinanceDashboard();
    if (error) return errBlock(error);
    if (!stats) return okBlock(null as unknown as PersonalFinanceSummary, true);

    const recentIncome = stats.monthIncome.slice(0, 5).map((i) => ({
      id: i.id,
      label: i.descricao,
      amount: Number(i.valor),
      kind: "receita" as const,
      date: i.data,
    }));
    // monthExpenses from expenseStats — use gastos via month filter already in stats
    const recentExpenses = (stats as { monthGastos?: { id: string; titulo: string; valor: number; data: string }[] })
      .monthGastos
      ? ((stats as { monthGastos: { id: string; titulo: string; valor: number; data: string }[] }).monthGastos
          .slice(0, 5)
          .map((g) => ({
            id: g.id,
            label: g.titulo,
            amount: Number(g.valor),
            kind: "despesa" as const,
            date: g.data,
          })))
      : [];

    const recent = [...recentIncome, ...recentExpenses]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);

    const data: PersonalFinanceSummary = {
      saldoAtual: stats.saldoAtual,
      hasSaldo: stats.hasInitialBalance,
      receitasMes: stats.totalIncomeMonth,
      despesasMes: stats.totalMonth,
      orcamentoMeta: stats.goalProgress?.meta ?? null,
      orcamentoPct: stats.goalProgress?.pct ?? null,
      budgetAlert: Boolean(
        stats.goalProgress &&
          stats.goalProgress.pct >= 80 &&
          stats.goalProgress.pct < 100
      ) || Boolean(stats.expenseAlert?.unusual),
      recentTransactions: recent,
    };

    const empty =
      !data.hasSaldo &&
      data.receitasMes === 0 &&
      data.despesasMes === 0 &&
      recent.length === 0;
    return okBlock(data, empty);
  } catch (e) {
    return errBlock(e instanceof Error ? e.message : "Erro financeiro");
  }
}

function startOfWeek(ref = new Date()) {
  const d = new Date(ref);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function loadHealthBlock(
  habits: HealthHabit[],
  workouts: HealthWorkout[],
  sessions: HealthSession[]
): Promise<DashboardBlock<PersonalHealthSummary>> {
  try {
    const weekStart = startOfWeek();
    const workoutToday = workouts.find((w) => isSameLocalDay(w.data));
    const pendingHabits = habits
      .filter((h) => h.status !== "concluido")
      .slice(0, 8)
      .map((h) => ({ id: h.id, titulo: h.titulo }));
    const leitura = sessions.find((s) => s.tipo === "leitura") ?? null;
    const meditacao = sessions.find((s) => s.tipo === "meditacao") ?? null;
    const workoutsThisWeek = workouts.filter(
      (w) => new Date(w.data + "T12:00:00") >= weekStart
    ).length;
    const habitsDoneThisWeek = habits.filter(
      (h) =>
        h.status === "concluido" && new Date(h.data + "T12:00:00") >= weekStart
    ).length;

    const data: PersonalHealthSummary = {
      workoutToday: workoutToday
        ? {
            id: workoutToday.id,
            nome: workoutToday.nome,
            duracaoMin: workoutToday.duracao_min,
          }
        : null,
      pendingHabits,
      leituraRecent: leitura
        ? { id: leitura.id, titulo: leitura.titulo, data: leitura.data }
        : null,
      meditacaoRecent: meditacao
        ? { id: meditacao.id, titulo: meditacao.titulo, data: meditacao.data }
        : null,
      workoutsThisWeek,
      habitsDoneThisWeek,
    };

    const empty =
      !data.workoutToday &&
      data.pendingHabits.length === 0 &&
      !data.leituraRecent &&
      !data.meditacaoRecent &&
      data.workoutsThisWeek === 0;
    return okBlock(data, empty);
  } catch (e) {
    return errBlock(e instanceof Error ? e.message : "Erro saúde");
  }
}

async function loadGoalsBlock(
  goals: Goal[]
): Promise<DashboardBlock<PersonalGoalsSummary>> {
  try {
    const active = getActiveGoals(goals);
    const nearDeadline = active
      .filter((g) => g.data_fim)
      .map((g) => ({ goal: g, fim: g.data_fim! }))
      .sort((a, b) => a.fim.localeCompare(b.fim))
      .slice(0, 5)
      .map(({ goal, fim }) => ({
        id: goal.id,
        titulo: goal.titulo,
        prazo: fim,
      }));

    const recentlyCompleted = goals
      .filter((g) => isGoalReached(g))
      .slice(0, 5)
      .map((g) => ({ id: g.id, titulo: g.titulo }));

    const data: PersonalGoalsSummary = {
      active: active.slice(0, 8).map((g) => {
        return {
          id: g.id,
          titulo: g.titulo,
          progressLabel: formatGoalProgress(g),
          prazo: g.data_fim,
        };
      }),
      nearDeadline,
      recentlyCompleted,
    };
    return okBlock(data, data.active.length === 0 && data.recentlyCompleted.length === 0);
  } catch (e) {
    return errBlock(e instanceof Error ? e.message : "Erro objetivos");
  }
}

async function loadCalendarBlock(
  eventos: Evento[],
  googleConnected: boolean
): Promise<DashboardBlock<PersonalCalendarSummary>> {
  try {
    const today = eventos
      .filter((e) => isSameLocalDay(e.data_inicio))
      .map((e) => ({
        id: e.id,
        titulo: e.titulo,
        local: e.local,
      }));
    const upcoming = eventos
      .filter((e) => e.data_inicio.slice(0, 10) > new Date().toISOString().slice(0, 10))
      .slice(0, 8)
      .map((e) => ({
        id: e.id,
        titulo: e.titulo,
        data: e.data_inicio.slice(0, 10),
        local: e.local,
      }));
    const data: PersonalCalendarSummary = { today, upcoming, googleConnected };
    return okBlock(data, today.length === 0 && upcoming.length === 0);
  } catch (e) {
    return errBlock(e instanceof Error ? e.message : "Erro calendário");
  }
}

async function loadExpertBlock(): Promise<DashboardBlock<PersonalExpertBrainSummary>> {
  try {
    const { dashboard, error } = await getExpertBrainDashboard();
    if (error) return errBlock(error);
    const errors = dashboard.ingestionBuckets?.failed ?? 0;
    const lastFromQueue =
      dashboard.ingestionQueue?.[0]?.updated_at ??
      dashboard.ingestionQueue?.[0]?.created_at ??
      null;
    const data: PersonalExpertBrainSummary = {
      contents:
        dashboard.metrics.sourcesReady +
        dashboard.metrics.lessons +
        dashboard.metrics.frameworks,
      pending: dashboard.metrics.queuePending,
      processing: dashboard.metrics.queueProcessing,
      errors,
      lastActivityAt: lastFromQueue,
    };
    const empty =
      data.contents === 0 &&
      data.pending === 0 &&
      data.processing === 0 &&
      data.errors === 0;
    return okBlock(data, empty);
  } catch (e) {
    return errBlock(e instanceof Error ? e.message : "Erro Expert Brain");
  }
}

/**
 * Aggregated PERSONAL dashboard — only the authenticated user's data.
 * Never reads another user_id or workspace tables.
 */
export async function getPersonalDashboardSummary(): Promise<PersonalDashboardSummary> {
  const { supabase, userId } = await getDataContext();

  const [eventosRes, habitsRes, workoutsRes, sessionsRes, goalsRes, googleConnected] =
    await Promise.all([
      new BaseRepository(supabase, "eventos", userId).findAll("data_inicio"),
      new BaseRepository(supabase, "health_habits", userId).findAll("data"),
      new BaseRepository(supabase, "health_workouts", userId).findAll("data"),
      new BaseRepository(supabase, "health_sessions", userId).findAll("data"),
      listGoals(),
      isGoogleCalendarConnected().catch(() => false),
    ]);

  const eventos = (eventosRes.data ?? []) as Evento[];
  const habits = (habitsRes.data ?? []) as HealthHabit[];
  const workouts = (workoutsRes.data ?? []) as HealthWorkout[];
  const sessions = (sessionsRes.data ?? []) as HealthSession[];
  const goals = goalsRes.goals ?? [];

  const [day, finance, health, goalsBlock, calendar, expertBrain] = await Promise.all([
    loadDayBlock(eventos, goals, habits, workouts),
    loadFinanceBlock(),
    loadHealthBlock(habits, workouts, sessions),
    loadGoalsBlock(goals),
    loadCalendarBlock(eventos, googleConnected),
    loadExpertBlock(),
  ]);

  // Attach recent gastos for finance if missing
  if (finance.status !== "error" && finance.data && finance.data.recentTransactions.length < 3) {
    const gastosRes = await new BaseRepository(supabase, "gastos", userId).findAll("data");
    const gastos = (gastosRes.data ?? []) as {
      id: string;
      titulo: string;
      valor: number;
      data: string;
    }[];
    const month = new Date().toISOString().slice(0, 7);
    const monthGastos = gastos
      .filter((g) => g.data.startsWith(month))
      .slice(0, 5)
      .map((g) => ({
        id: g.id,
        label: g.titulo,
        amount: Number(g.valor),
        kind: "despesa" as const,
        date: g.data,
      }));
    const merged = [...finance.data.recentTransactions, ...monthGastos]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);
    finance.data = { ...finance.data, recentTransactions: merged };
    if (merged.length > 0 && finance.status === "empty") {
      finance.status = "ok";
    }
  }

  return {
    mode: "personal",
    day,
    finance,
    health,
    goals: goalsBlock,
    calendar,
    expertBrain,
  };
}
