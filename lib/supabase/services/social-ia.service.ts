import {
  ConteudosRepository,
  GrowthLeadsRepository,
  GrowthProfilesRepository,
} from "@/lib/supabase/repositories";
import type { Conteudo, GrowthLead, GrowthProfile } from "@/types/database";
import { buildSocialIaDataContext } from "@/utils/social";
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

export async function getSocialIaMentorContext(): Promise<{
  context: string | null;
  conteudos: Conteudo[];
  profiles: GrowthProfile[];
  leads: GrowthLead[];
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return {
      context: null,
      conteudos: [],
      profiles: [],
      leads: [],
      error: "Usuário não autenticado.",
    };
  }

  const { supabase, userId } = ctx;

  const [conteudosLoad, profilesLoad, leadsLoad] = await Promise.all([
    safeLoad(
      () => new ConteudosRepository(supabase, userId).findAll(),
      []
    ),
    safeLoad(
      () => new GrowthProfilesRepository(supabase, userId).findAll(),
      []
    ),
    safeLoad(
      () => new GrowthLeadsRepository(supabase, userId).findAll(),
      []
    ),
  ]);

  const blockingError =
    conteudosLoad.error ?? profilesLoad.error ?? leadsLoad.error;

  if (blockingError && !isMissingSupabaseTableError(blockingError)) {
    return {
      context: null,
      conteudos: [],
      profiles: [],
      leads: [],
      error: blockingError,
    };
  }

  const conteudos = conteudosLoad.data as Conteudo[];
  const profiles = profilesLoad.data as GrowthProfile[];
  const leads = leadsLoad.data as GrowthLead[];

  return {
    context: buildSocialIaDataContext({ conteudos, profiles, leads }),
    conteudos,
    profiles,
    leads,
    error: null,
  };
}
