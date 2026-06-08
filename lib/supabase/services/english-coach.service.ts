import { BaseRepository } from "@/lib/supabase/repositories";
import { LanguageLessonsRepository } from "@/lib/supabase/repositories/language-lessons.repository";
import { LanguageProgressRepository } from "@/lib/supabase/repositories/language-progress.repository";
import { LanguageSessionsRepository } from "@/lib/supabase/repositories/language-sessions.repository";
import type {
  LanguageLesson,
  LanguageProgress,
  LanguageSession,
} from "@/types/database";
import { buildEnglishCoachDataContext } from "@/utils/english";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { appendUserIdentityContext } from "./identity.service";
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
      console.warn("[english-coach] Erro ao carregar dados:", error);
      return { data: fallback, unavailable: false, error };
    }
    return { data: data ?? fallback, unavailable: false, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isMissingSupabaseTableError(message)) {
      return { data: fallback, unavailable: true, error: null };
    }
    return { data: fallback, unavailable: false, error: message };
  }
}

export async function getEnglishCoachMentorContext(): Promise<{
  context: string | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { context: null, error: "Usuário não autenticado." };
  }

  const { supabase, userId } = ctx;

  const [progressLoad, sessionsLoad, lessonsLoad] = await Promise.all([
    safeLoad(
      () => new LanguageProgressRepository(supabase, userId).findByUser(),
      null
    ),
    safeLoad(
      () => new LanguageSessionsRepository(supabase, userId).findAll("data"),
      []
    ),
    safeLoad(
      () => new LanguageLessonsRepository(supabase, userId).findAll("created_at"),
      []
    ),
  ]);

  const blockingError =
    progressLoad.error ?? sessionsLoad.error ?? lessonsLoad.error;

  if (blockingError && !isMissingSupabaseTableError(blockingError)) {
    return { context: null, error: blockingError };
  }

  const progress = progressLoad.data as LanguageProgress | null;
  const sessions = sessionsLoad.data as LanguageSession[];
  const lessons = lessonsLoad.data as LanguageLesson[];

  const context = await appendUserIdentityContext(
    buildEnglishCoachDataContext(progress, sessions, lessons)
  );

  return {
    context,
    error: null,
  };
}

export async function ensureLanguageProgress(): Promise<{
  progress: LanguageProgress | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) return { progress: null, error: "Usuário não autenticado." };

  const repo = new LanguageProgressRepository(ctx.supabase, ctx.userId);
  const existing = await repo.findByUser();
  if (existing.error) return { progress: null, error: existing.error };
  if (existing.data) return { progress: existing.data, error: null };

  const created = await repo.create({});
  return { progress: created.data, error: created.error };
}
