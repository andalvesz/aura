import type { SupabaseClient } from "@supabase/supabase-js";
import { BaseRepository } from "@/lib/supabase/repositories/base.repository";
import { GoalsRepository } from "@/lib/supabase/repositories/goals.repository";
import type {
  AlveszEvento,
  Conteudo,
  Database,
  Evento,
  FinancialIncome,
  Goal,
  GoalTipo,
  GrowthLead,
  HealthWorkout,
  TableInsert,
} from "@/types/database";
import { isDateInGoalRange } from "@/utils/goals";
import { normalizeConteudoStatus } from "@/utils/social";
import { getOptionalDataContext } from "./context";

type SyncContext = {
  financialIncome: FinancialIncome[];
  conteudos: Conteudo[];
  eventos: Evento[];
  alveszEventos: AlveszEvento[];
  leads: GrowthLead[];
  healthWorkouts: HealthWorkout[];
};

function computeGoalAtual(goal: Goal, ctx: SyncContext): number {
  switch (goal.tipo as GoalTipo) {
    case "financeira":
      return ctx.financialIncome
        .filter((i) => isDateInGoalRange(i.data, goal))
        .reduce((s, i) => s + Number(i.valor), 0);
    case "conteudo":
      return ctx.conteudos.filter(
        (c) =>
          normalizeConteudoStatus(c.status) === "publicado" &&
          isDateInGoalRange(c.data_publicacao ?? c.updated_at, goal)
      ).length;
    case "eventos":
      return (
        ctx.eventos.filter((e) => isDateInGoalRange(e.data_inicio, goal)).length +
        ctx.alveszEventos.filter((e) => isDateInGoalRange(e.data_evento, goal)).length
      );
    case "vendas":
      return ctx.leads.filter(
        (l) =>
          l.status === "fechado" && isDateInGoalRange(l.updated_at, goal)
      ).length;
    case "saude":
      return ctx.healthWorkouts.filter((w) => isDateInGoalRange(w.data, goal)).length;
    case "personalizada":
    default:
      return Number(goal.atual);
  }
}

async function loadSyncContext(
  userId: string,
  supabase: SupabaseClient<Database>
) {
  const [incomeRes, conteudosRes, eventosRes, alveszRes, leadsRes, workoutsRes] =
    await Promise.all([
      new BaseRepository(supabase, "financial_income", userId).findAll("data"),
      new BaseRepository(supabase, "conteudos", userId).findAll("created_at"),
      new BaseRepository(supabase, "eventos", userId).findAll("data_inicio"),
      new BaseRepository(supabase, "alvesz_eventos", userId).findAll("data_evento"),
      new BaseRepository(supabase, "growth_leads", userId).findAll("created_at"),
      new BaseRepository(supabase, "health_workouts", userId).findAll("data"),
    ]);

  return {
    financialIncome: (incomeRes.data ?? []) as FinancialIncome[],
    conteudos: (conteudosRes.data ?? []) as Conteudo[],
    eventos: (eventosRes.data ?? []) as Evento[],
    alveszEventos: (alveszRes.data ?? []) as AlveszEvento[],
    leads: (leadsRes.data ?? []) as GrowthLead[],
    healthWorkouts: (workoutsRes.data ?? []) as HealthWorkout[],
  } satisfies SyncContext;
}

export async function listGoals(): Promise<{ goals: Goal[]; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { goals: [], error: "Usuário não autenticado." };
  }

  const repo = new GoalsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.findAll("data_fim");
  if (error) return { goals: [], error };
  return { goals: data ?? [], error: null };
}

export async function syncGoalsProgress(): Promise<{
  goals: Goal[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { goals: [], error: "Usuário não autenticado." };
  }

  const repo = new GoalsRepository(ctx.supabase, ctx.userId);
  const { data: goals, error: listError } = await repo.findAll("data_fim");
  if (listError) return { goals: [], error: listError };

  const syncCtx = await loadSyncContext(ctx.userId, ctx.supabase);
  const autoTypes = new Set<GoalTipo>([
    "financeira",
    "conteudo",
    "eventos",
    "vendas",
    "saude",
  ]);

  for (const goal of goals ?? []) {
    if (goal.status !== "ativa" || !autoTypes.has(goal.tipo)) continue;

    const atual = computeGoalAtual(goal, syncCtx);
    const status = atual >= Number(goal.meta) ? "concluida" : goal.status;

    if (atual !== Number(goal.atual) || status !== goal.status) {
      await repo.update(goal.id, { atual, status });
    }
  }

  const { data: refreshed, error: refreshError } = await repo.findAll("data_fim");
  return { goals: refreshed ?? [], error: refreshError };
}

export async function createGoal(
  payload: Omit<TableInsert<"goals">, "user_id">
): Promise<{ goal: Goal | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { goal: null, error: "Usuário não autenticado." };
  }

  const repo = new GoalsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.create({
    ...payload,
    status: payload.status ?? "ativa",
    atual: payload.atual ?? 0,
  });

  if (error) return { goal: null, error };
  await syncGoalsProgress();
  const { goals } = await listGoals();
  const created = goals.find((g) => g.id === data?.id) ?? data;
  return { goal: created ?? null, error: null };
}

export async function updateGoal(
  id: string,
  patch: Partial<Pick<Goal, "titulo" | "tipo" | "meta" | "atual" | "data_inicio" | "data_fim" | "status">>
): Promise<{ goal: Goal | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { goal: null, error: "Usuário não autenticado." };
  }

  const repo = new GoalsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.update(id, patch);
  if (error) return { goal: null, error };

  await syncGoalsProgress();
  const { goals } = await listGoals();
  const updated = goals.find((g) => g.id === id) ?? data;
  return { goal: updated ?? null, error: null };
}

export async function deleteGoal(id: string): Promise<{ error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { error: "Usuário não autenticado." };
  }

  const repo = new GoalsRepository(ctx.supabase, ctx.userId);
  const { error } = await repo.delete(id);
  return { error };
}
