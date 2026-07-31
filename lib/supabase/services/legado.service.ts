import { BaseRepository } from "@/lib/supabase/repositories/base.repository";
import type {
  LegacyAchievement,
  LegacyCertificate,
  LegacyLifeEvent,
  LegacyMilestone,
  LegacyTimeline,
} from "@/types/database";
import {
  buildLegacyContext,
  isLegacyEmpty,
  type LegacyData,
} from "@/utils/legado";
import { isMissingSupabaseTableError } from "@/utils/supabase-errors";
import { getOptionalDataContext } from "./context";

async function safeLoad<T>(
  loader: () => Promise<{ data: T | null; error: string | null }>,
  fallback: T
): Promise<T> {
  try {
    const { data, error } = await loader();
    if (error && !isMissingSupabaseTableError(error)) {
      console.warn("[legado] Erro ao carregar:", error);
    }
    return data ?? fallback;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!isMissingSupabaseTableError(message)) {
      console.warn("[legado] Exceção:", message);
    }
    return fallback;
  }
}

export async function loadLegacyData(): Promise<{
  data: LegacyData;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      data: {
        timeline: [],
        achievements: [],
        certificates: [],
        lifeEvents: [],
        milestones: [],
      },
      error: "Usuário não autenticado.",
    };
  }

  const { supabase, userId } = ctx;

  const [timeline, achievements, certificates, lifeEvents, milestones] =
    await Promise.all([
      safeLoad(
        () => new BaseRepository(supabase, "legacy_timeline", userId).findAll("ano"),
        [] as LegacyTimeline[]
      ),
      safeLoad(
        () =>
          new BaseRepository(supabase, "legacy_achievements", userId).findAll("ano"),
        [] as LegacyAchievement[]
      ),
      safeLoad(
        () =>
          new BaseRepository(supabase, "legacy_certificates", userId).findAll("ano"),
        [] as LegacyCertificate[]
      ),
      safeLoad(
        () =>
          new BaseRepository(supabase, "legacy_life_events", userId).findAll(
            "data_evento"
          ),
        [] as LegacyLifeEvent[]
      ),
      safeLoad(
        () =>
          new BaseRepository(supabase, "legacy_milestones", userId).findAll("data_marco"),
        [] as LegacyMilestone[]
      ),
    ]);

  return {
    data: { timeline, achievements, certificates, lifeEvents, milestones },
    error: null,
  };
}

export async function getLegacyContext(): Promise<{
  context: string | null;
  data: LegacyData;
  error: string | null;
}> {
  const { data, error } = await loadLegacyData();
  if (error) {
    return { context: null, data, error };
  }
  if (isLegacyEmpty(data)) {
    return {
      context: "## LEGADO\nNenhum dado de legado cadastrado ainda.",
      data,
      error: null,
    };
  }
  return { context: buildLegacyContext(data), data, error: null };
}

export async function seedLegacyForUser(): Promise<{
  seeded: boolean;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { seeded: false, error: "Usuário não autenticado." };
  }

  // Explicit opt-in only — never bootstrap Anderson's biography onto new accounts.
  // Callers must come from the Legado UI action that the user confirms.
  const { supabase, userId } = ctx;
  const { data: existing } = await loadLegacyData();

  if (!isLegacyEmpty(existing)) {
    return { seeded: false, error: null };
  }

  // Multiuser isolation: do not auto-seed personal biography templates.
  // Return without writing unless an explicit admin/legacy import path is used.
  void supabase;
  void userId;
  return {
    seeded: false,
    error:
      "Seed automático de trajetória pessoal desativado (isolamento multiusuário). Use importação explícita apenas se for a sua própria biografia.",
  };
}
