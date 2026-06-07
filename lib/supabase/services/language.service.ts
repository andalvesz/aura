import { LanguageLessonsRepository } from "@/lib/supabase/repositories/language-lessons.repository";
import { LanguageProgressRepository } from "@/lib/supabase/repositories/language-progress.repository";
import { LanguageSessionsRepository } from "@/lib/supabase/repositories/language-sessions.repository";
import { awardAuraXp } from "@/lib/supabase/services/xp.service";
import type {
  Json,
  LanguageLesson,
  LanguageModo,
  LanguageProgress,
  LanguageSession,
  TableInsert,
  TableUpdate,
} from "@/types/database";
import { computeLanguageStreak } from "@/utils/english";
import { todayIsoDate } from "@/utils/health";
import { ensureLanguageProgress } from "./english-coach.service";
import { getOptionalDataContext } from "./context";

async function updateProgress(
  patch: TableUpdate<"language_progress">
): Promise<{ progress: LanguageProgress | null; error: string | null }> {
  const { progress, error } = await ensureLanguageProgress();
  if (error || !progress) return { progress: null, error };

  const ctx = await getOptionalDataContext();
  if (!ctx) return { progress: null, error: "Usuário não autenticado." };

  const repo = new LanguageProgressRepository(ctx.supabase, ctx.userId);
  const result = await repo.update(progress.id, patch);
  return { progress: result.data, error: result.error };
}

export async function recordPracticeDay(): Promise<{
  progress: LanguageProgress | null;
  error: string | null;
}> {
  const { progress, error } = await ensureLanguageProgress();
  if (error || !progress) return { progress: null, error };

  const today = todayIsoDate();
  const next = computeLanguageStreak(
    progress.streak_dias,
    progress.ultima_pratica,
    today
  );

  return updateProgress({
    streak_dias: next.streak_dias,
    ultima_pratica: next.ultima_pratica,
  });
}

export async function completeLesson(
  lessonId: string
): Promise<{ lesson: LanguageLesson | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { lesson: null, error: "Usuário não autenticado." };

  const repo = new LanguageLessonsRepository(ctx.supabase, ctx.userId);
  const { data: lesson, error } = await repo.update(lessonId, {
    status: "concluido",
    concluido_em: new Date().toISOString(),
  });

  if (error) return { lesson: null, error };

  const { progress } = await ensureLanguageProgress();
  if (progress) {
    await updateProgress({
      aulas_concluidas: progress.aulas_concluidas + 1,
    });
  }

  await recordPracticeDay();
  await awardAuraXp("concluir_aula_ingles");

  return { lesson: lesson, error: null };
}

export async function completeExercise(
  sessionId: string
): Promise<{ session: LanguageSession | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { session: null, error: "Usuário não autenticado." };

  const repo = new LanguageSessionsRepository(ctx.supabase, ctx.userId);
  const { data: session, error } = await repo.update(sessionId, {
    status: "concluido",
  });

  if (error) return { session: null, error };

  const { progress } = await ensureLanguageProgress();
  if (progress) {
    await updateProgress({
      exercicios_concluidos: progress.exercicios_concluidos + 1,
    });
  }

  await recordPracticeDay();
  await awardAuraXp("exercicio_ingles_concluido");

  return { session, error: null };
}

export async function completeModule(
  modo: LanguageModo
): Promise<{ progress: LanguageProgress | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { progress: null, error: "Usuário não autenticado." };

  const lessonsRepo = new LanguageLessonsRepository(ctx.supabase, ctx.userId);
  const { data: lessons } = await lessonsRepo.findByModo(modo);
  const pending = (lessons ?? []).filter((l) => l.status !== "concluido");

  if (pending.length > 0) {
    return {
      progress: null,
      error: "Conclua todas as lições do módulo antes de finalizar.",
    };
  }

  const { progress } = await ensureLanguageProgress();
  if (!progress) return { progress: null, error: "Progresso não encontrado." };

  const result = await updateProgress({
    modulos_concluidos: progress.modulos_concluidos + 1,
    modo_favorito: modo,
  });

  await recordPracticeDay();
  await awardAuraXp("modulo_ingles_completo");

  return result;
}

export async function saveGeneratedLesson(params: {
  modo: LanguageModo;
  titulo: string;
  vocabulario: Json;
  frases: Json;
  exercicios: Json;
  sessionId?: string | null;
}): Promise<{ lesson: LanguageLesson | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { lesson: null, error: "Usuário não autenticado." };

  const repo = new LanguageLessonsRepository(ctx.supabase, ctx.userId);
  const { data: existing } = await repo.findByModo(params.modo);
  const ordem = (existing ?? []).length;

  const payload: Omit<TableInsert<"language_lessons">, "user_id"> = {
    modo: params.modo,
    titulo: params.titulo,
    vocabulario: params.vocabulario,
    frases: params.frases,
    exercicios: params.exercicios,
    status: "pendente",
    ordem,
    session_id: params.sessionId ?? null,
  };

  const { data, error } = await repo.create(payload);
  return { lesson: data, error };
}

export async function saveGeneratedSession(params: {
  modo: LanguageModo;
  tipo: LanguageSession["tipo"];
  titulo: string;
  conteudo: Json;
  duracao_min?: number;
}): Promise<{ session: LanguageSession | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { session: null, error: "Usuário não autenticado." };

  const repo = new LanguageSessionsRepository(ctx.supabase, ctx.userId);
  const { data, error } = await repo.create({
    modo: params.modo,
    tipo: params.tipo,
    titulo: params.titulo,
    conteudo: params.conteudo,
    duracao_min: params.duracao_min ?? 15,
    data: todayIsoDate(),
    status: "em_andamento",
  });

  return { session: data, error };
}
