import { BaseRepository } from "@/lib/supabase/repositories/base.repository";
import {
  ConteudosRepository,
  GrowthLeadsRepository,
  GrowthProfilesRepository,
} from "@/lib/supabase/repositories";
import { syncGoalsProgress } from "@/lib/supabase/services/goals.service";
import type {
  AlveszEvento,
  Conteudo,
  Evento,
  Goal,
  GrowthLead,
  GrowthProfile,
  InstagramMarca,
  LanguageProgress,
  LanguageSession,
  Lead,
  Orcamento,
  Trip,
  TripChecklistItem,
} from "@/types/database";
import {
  buildInstagramExpandedContext,
  buildInstagramGrowthSnapshot,
} from "@/utils/instagram";
import { buildSocialIaDataContext } from "@/utils/social";
import {
  buildSocialIntelligenceContext,
  computeAllSocialOpportunities,
  computePostingStreak,
  computeSocialReport,
  getAtrasadosConteudos,
} from "@/utils/social-intelligence";
import { getWeekRange, isInDateRange } from "@/utils/executive-reports";
import { workoutsThisWeek } from "@/utils/health";
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
      console.warn("[social-ia] Erro ao carregar dados:", error);
      return { data: fallback, unavailable: false, error };
    }

    return { data: data ?? fallback, unavailable: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingSupabaseTableError(message)) {
      return { data: fallback, unavailable: true, error: null };
    }
    console.warn("[social-ia] Exceção ao carregar dados:", message);
    return { data: fallback, unavailable: false, error: message };
  }
}

export async function getSocialIaMentorContext(options?: {
  marca?: InstagramMarca | null;
}): Promise<{
  context: string | null;
  conteudos: Conteudo[];
  profiles: GrowthProfile[];
  leads: GrowthLead[];
  goals: Goal[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      context: null,
      conteudos: [],
      profiles: [],
      leads: [],
      goals: [],
      error: "Usuário não autenticado.",
    };
  }

  const { supabase, userId } = ctx;
  const { start, end } = getWeekRange();

  const [
    conteudosLoad,
    profilesLoad,
    leadsLoad,
    goalsLoad,
    eventosLoad,
    alveszLoad,
    incomeLoad,
    workoutsLoad,
    orcamentosLoad,
    consorciosLeadsLoad,
    tripsLoad,
    checklistLoad,
    languageProgressLoad,
    languageSessionsLoad,
  ] = await Promise.all([
    safeLoad(() => new ConteudosRepository(supabase, userId).findAll(), []),
    safeLoad(() => new GrowthProfilesRepository(supabase, userId).findAll(), []),
    safeLoad(() => new GrowthLeadsRepository(supabase, userId).findAll(), []),
    syncGoalsProgress().then((r) => ({
      data: r.goals,
      error: r.error,
    })),
    safeLoad(
      () => new BaseRepository(supabase, "eventos", userId).findAll("data_inicio"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "alvesz_eventos", userId).findAll("data_evento"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "financial_income", userId).findAll("data"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "health_workouts", userId).findAll("data"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "orcamentos", userId).findAll("created_at"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "leads", userId).findAll("created_at"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "trips", userId).findAll("data_ida"),
      []
    ),
    safeLoad(
      () => new BaseRepository(supabase, "trip_checklist_items", userId).findAll("ordem"),
      []
    ),
    safeLoad(async () => {
      const { data, error } = await supabase
        .from("language_progress")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return { data: data as LanguageProgress | null, error: error?.message ?? null };
    }, null),
    safeLoad(
      () => new BaseRepository(supabase, "language_sessions", userId).findAll("data"),
      []
    ),
  ]);

  const blockingError =
    conteudosLoad.error ?? profilesLoad.error ?? leadsLoad.error ?? goalsLoad.error;

  if (blockingError && !isMissingSupabaseTableError(blockingError)) {
    return {
      context: null,
      conteudos: [],
      profiles: [],
      leads: [],
      goals: [],
      error: blockingError,
    };
  }

  const conteudos = conteudosLoad.data as Conteudo[];
  const profiles = profilesLoad.data as GrowthProfile[];
  const leads = leadsLoad.data as GrowthLead[];
  const goals = (goalsLoad.data ?? []) as Goal[];
  const eventos = eventosLoad.data as Evento[];
  const alveszEventos = alveszLoad.data as AlveszEvento[];

  const weekIncome = (incomeLoad.data as { data: string; valor: number }[])
    .filter((i) => isInDateRange(i.data, start, end))
    .reduce((s, i) => s + Number(i.valor), 0);

  const snapshot = buildInstagramGrowthSnapshot({
    goals,
    eventos,
    alveszEventos,
    weekIncome,
    workoutsWeek: workoutsThisWeek(
      workoutsLoad.data as Parameters<typeof workoutsThisWeek>[0]
    ).length,
    leadsCount: leads.filter((l) => l.status !== "fechado" && l.status !== "perdido").length,
  });

  const opportunities = computeAllSocialOpportunities({
    orcamentos: orcamentosLoad.data as Orcamento[],
    alveszEventos,
    eventos,
    leads: consorciosLeadsLoad.data as Lead[],
    trips: tripsLoad.data as Trip[],
    checklist: checklistLoad.data as TripChecklistItem[],
    languageProgress: languageProgressLoad.data,
    languageSessions: languageSessionsLoad.data as LanguageSession[],
    goals,
    activeMarca: options?.marca ?? undefined,
  });

  const report = computeSocialReport(conteudos, options?.marca ?? "all", "semana");
  const streak = computePostingStreak(conteudos);
  const atrasados = getAtrasadosConteudos(conteudos);

  const baseContext = buildSocialIaDataContext({ conteudos, profiles, leads });
  const instagramContext = buildInstagramExpandedContext({
    conteudos,
    profiles,
    marca: options?.marca,
    snapshot,
  });
  const intelligenceContext = buildSocialIntelligenceContext({
    opportunities,
    report,
    streak,
    atrasados,
  });

  return {
    context: `${baseContext}\n\n${instagramContext}\n\n${intelligenceContext}`,
    conteudos,
    profiles,
    leads,
    goals,
    error: null,
  };
}
