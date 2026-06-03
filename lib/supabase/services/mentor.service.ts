import {
  BaseRepository,
  ConteudosRepository,
  GastosRepository,
  OrcamentosRepository,
} from "@/lib/supabase/repositories";
import {
  GrowthGoalsRepository,
  GrowthLeadsRepository,
  GrowthMissionsRepository,
} from "@/lib/supabase/repositories/growth.repository";
import { listClientes } from "@/lib/supabase/services/alvesz.service";
import { listEventos } from "@/lib/supabase/services/eventos.service";
import type {
  Cliente,
  Conteudo,
  Gasto,
  GrowthGoal,
  GrowthLead,
  GrowthMission,
  HealthHabit,
  HealthMeal,
  HealthSession,
  HealthWorkout,
  Orcamento,
} from "@/types/database";
import { getCurrentMonthReference } from "@/utils/growth";
import {
  buildAuraGlobalSummaryContext,
  type AuraGlobalSummaryData,
} from "@/utils/mentor";
import type { OrcamentoWithCliente } from "@/utils/nexus";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext } from "./context";

type SafeLoadResult<T> = {
  data: T;
  unavailable: boolean;
  error: string | null;
};

async function safeLoad<T>(
  loader: () => Promise<{ data: T | null; error: string | null }>,
  fallback: T
): Promise<SafeLoadResult<T>> {
  try {
    const { data, error } = await loader();

    if (error) {
      if (isMissingSupabaseTableError(error)) {
        return { data: fallback, unavailable: true, error: null };
      }
      console.warn("[mentor] Erro ao carregar dados:", error);
      return { data: fallback, unavailable: false, error };
    }

    return { data: data ?? fallback, unavailable: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingSupabaseTableError(message)) {
      return { data: fallback, unavailable: true, error: null };
    }
    console.warn("[mentor] Exceção ao carregar dados:", message);
    return { data: fallback, unavailable: false, error: message };
  }
}

function attachClientesToOrcamentos(
  orcamentos: Orcamento[],
  clientes: Cliente[]
): OrcamentoWithCliente[] {
  const clientesById = new Map(clientes.map((cliente) => [cliente.id, cliente]));

  return orcamentos.map((orcamento) => ({
    ...orcamento,
    clientes: orcamento.cliente_id
      ? (clientesById.get(orcamento.cliente_id) ?? null)
      : null,
  }));
}

async function loadAuraGlobalSummaryData(): Promise<{
  data: AuraGlobalSummaryData | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { data: null, error: "Usuário não autenticado." };
  }

  const monthRef = getCurrentMonthReference();
  const { supabase, userId } = ctx;

  const [
    clientesLoad,
    orcamentosLoad,
    eventosLoad,
    leadsLoad,
    goalLoad,
    missionsLoad,
    conteudosLoad,
    gastosLoad,
    habitsLoad,
    workoutsLoad,
    mealsLoad,
    sessionsLoad,
  ] = await Promise.all([
    safeLoad(() => listClientes(), []),
    safeLoad(
      () => new OrcamentosRepository(supabase, userId).findAll(),
      []
    ),
    safeLoad(() => listEventos(), []),
    safeLoad(
      () => new GrowthLeadsRepository(supabase, userId).findAll(),
      []
    ),
    safeLoad(
      () => new GrowthGoalsRepository(supabase, userId).findCurrentMonth(monthRef),
      null
    ),
    safeLoad(
      () => new GrowthMissionsRepository(supabase, userId).findAll("mission_date"),
      []
    ),
    safeLoad(
      () => new ConteudosRepository(supabase, userId).findAll(),
      []
    ),
    safeLoad(
      () => new GastosRepository(supabase, userId).findAll("data"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "health_habits", userId).findAll("data"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "health_workouts", userId).findAll("data"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "health_meals", userId).findAll("data"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "health_sessions", userId).findAll("data"),
      []
    ),
  ]);

  const blockingError =
    leadsLoad.error ??
    missionsLoad.error ??
    goalLoad.error ??
    clientesLoad.error ??
    orcamentosLoad.error ??
    eventosLoad.error ??
    conteudosLoad.error ??
    gastosLoad.error ??
    habitsLoad.error ??
    workoutsLoad.error ??
    mealsLoad.error ??
    sessionsLoad.error;

  if (blockingError && !isMissingSupabaseTableError(blockingError)) {
    return { data: null, error: blockingError };
  }

  const clientes = clientesLoad.data;
  const orcamentos = attachClientesToOrcamentos(orcamentosLoad.data, clientes);
  const healthUnavailable =
    habitsLoad.unavailable &&
    workoutsLoad.unavailable &&
    mealsLoad.unavailable &&
    sessionsLoad.unavailable;

  return {
    data: {
      clientes,
      orcamentos,
      eventos: eventosLoad.data,
      leads: leadsLoad.data as GrowthLead[],
      goal: goalLoad.data as GrowthGoal | null,
      missions: missionsLoad.data as GrowthMission[],
      alveszAvailable: !(clientesLoad.unavailable && orcamentosLoad.unavailable),
      calendarAvailable: !eventosLoad.unavailable,
      conteudos: conteudosLoad.data as Conteudo[],
      gastos: gastosLoad.data as Gasto[],
      healthHabits: habitsLoad.data as HealthHabit[],
      healthWorkouts: workoutsLoad.data as HealthWorkout[],
      healthMeals: mealsLoad.data as HealthMeal[],
      healthSessions: sessionsLoad.data as HealthSession[],
      socialAvailable: !conteudosLoad.unavailable,
      financeAvailable: !gastosLoad.unavailable,
      healthAvailable: !healthUnavailable,
    },
    error: null,
  };
}

export async function getAuraGlobalSummaryMentorContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const { data, error } = await loadAuraGlobalSummaryData();
  if (error || !data) {
    return { context: null, error };
  }

  return { context: buildAuraGlobalSummaryContext(data), error: null };
}
