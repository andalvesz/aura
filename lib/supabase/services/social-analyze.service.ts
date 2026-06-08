import { GrowthProfilesRepository } from "@/lib/supabase/repositories";
import type { GrowthProfile, InstagramMarca } from "@/types/database";
import type { ProfileAnalysisResult } from "@/lib/growth/types";
import { generateProfileAnalysis } from "@/lib/growth/profile-analysis";
import { getOptionalDataContext } from "./context";

export async function analyzeInstagramProfile(profileId: string): Promise<{
  analysis: ProfileAnalysisResult | null;
  error: string | null;
}> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { analysis: null, error: "Usuário não autenticado." };
  }

  const repo = new GrowthProfilesRepository(ctx.supabase, ctx.userId);
  const { data: profile, error: loadError } = await repo.findById(profileId);
  if (loadError || !profile) {
    return { analysis: null, error: loadError ?? "Perfil não encontrado." };
  }

  try {
    const { analysis } = await generateProfileAnalysis(profile);
    await repo.update(profileId, {
      analise: analysis as unknown as Record<string, unknown>,
    });
    return { analysis, error: null };
  } catch {
    return { analysis: null, error: "Erro ao analisar perfil." };
  }
}

export async function upsertInstagramProfile(payload: {
  marca: InstagramMarca;
  username: string;
  bio?: string;
  nicho?: string;
  objetivo?: string;
  frequencia_conteudo?: string;
}): Promise<{ profile: GrowthProfile | null; error: string | null }> {
  const ctx = await getOptionalDataContext();
  if (!ctx) {
    return { profile: null, error: "Usuário não autenticado." };
  }

  const repo = new GrowthProfilesRepository(ctx.supabase, ctx.userId);
  const { data: existing } = await repo.findAll();

  const match = (existing ?? []).find((p) => p.marca === payload.marca);
  const row = {
    plataforma: "Instagram",
    username: payload.username,
    marca: payload.marca,
    bio: payload.bio ?? null,
    nicho: payload.nicho ?? null,
    objetivo: payload.objetivo ?? null,
    frequencia_conteudo: payload.frequencia_conteudo ?? null,
    observacoes: payload.bio ?? null,
  };

  if (match) {
    const { data, error } = await repo.update(match.id, row);
    if (error) return { profile: null, error };
    return { profile: data, error: null };
  }

  const { data, error } = await repo.create(row);
  if (error) return { profile: null, error };
  return { profile: data, error: null };
}
