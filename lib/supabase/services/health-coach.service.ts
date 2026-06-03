import { BaseRepository } from "@/lib/supabase/repositories";
import type {
  HealthHabit,
  HealthMeal,
  HealthSession,
  HealthWorkout,
} from "@/types/database";
import { buildHealthCoachDataContext } from "@/utils/health";
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
      console.warn("[health-coach] Erro ao carregar dados:", error);
      return { data: fallback, unavailable: false, error };
    }

    return { data: data ?? fallback, unavailable: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingSupabaseTableError(message)) {
      return { data: fallback, unavailable: true, error: null };
    }
    console.warn("[health-coach] Exceção ao carregar dados:", message);
    return { data: fallback, unavailable: false, error: message };
  }
}

export async function getHealthCoachMentorContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { context: null, error: "Usuário não autenticado." };
  }

  const { supabase, userId } = ctx;

  const [habitsLoad, workoutsLoad, mealsLoad, sessionsLoad] = await Promise.all([
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
    habitsLoad.error ?? workoutsLoad.error ?? mealsLoad.error ?? sessionsLoad.error;

  if (blockingError && !isMissingSupabaseTableError(blockingError)) {
    return { context: null, error: blockingError };
  }

  const habits = habitsLoad.data as HealthHabit[];
  const workouts = workoutsLoad.data as HealthWorkout[];
  const meals = mealsLoad.data as HealthMeal[];
  const sessions = sessionsLoad.data as HealthSession[];

  return {
    context: buildHealthCoachDataContext(habits, workouts, meals, sessions),
    error: null,
  };
}
