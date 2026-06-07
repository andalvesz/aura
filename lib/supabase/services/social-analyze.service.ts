import OpenAI, { APIError } from "openai";
import { GrowthProfilesRepository } from "@/lib/supabase/repositories";
import type { GrowthProfile, InstagramMarca } from "@/types/database";
import type { ProfileAnalysisResult } from "@/lib/growth/types";
import { getMarcaThemes, MARCA_LABELS } from "@/utils/instagram";
import { safeJsonParse } from "@/utils/safe-json";
import { getOptionalDataContext } from "./context";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function fallbackAnalysis(profile: GrowthProfile): ProfileAnalysisResult {
  const marca = (profile.marca ?? "marca_pessoal") as InstagramMarca;
  const themes = getMarcaThemes(marca);
  return {
    summary: `Perfil ${MARCA_LABELS[marca]} (@${profile.username}) focado em ${profile.nicho ?? themes.join(", ")}.`,
    strengths: [
      profile.objetivo ? `Objetivo claro: ${profile.objetivo}` : "Objetivo definido no cadastro",
      `Temas fortes: ${themes.join(", ")}`,
    ],
    improvements: [
      profile.frequencia_conteudo
        ? `Manter frequência: ${profile.frequencia_conteudo}`
        : "Definir frequência semanal de publicação",
      "Diversificar formatos (Reels + Stories)",
    ],
    contentIdeas: themes.map((t) => `Conteúdo sobre ${t}`),
    generatedAt: new Date().toISOString(),
  };
}

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

  const marca = (profile.marca ?? "marca_pessoal") as InstagramMarca;
  const themes = getMarcaThemes(marca);
  const fallback = () => fallbackAnalysis(profile);

  if (!process.env.OPENAI_API_KEY) {
    const analysis = fallback();
    await repo.update(profileId, { analise: analysis as unknown as Record<string, unknown> });
    return { analysis, error: null };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você analisa perfis Instagram para crescimento. Português do Brasil, tom estratégico.
Analise bio, nicho, objetivo e frequência. Responda APENAS JSON:
{
  "summary": "string",
  "strengths": ["string"],
  "improvements": ["string"],
  "contentIdeas": ["string"],
  "frequenciaRecomendada": "string"
}`,
        },
        {
          role: "user",
          content: `Marca: ${MARCA_LABELS[marca]}
Username: @${profile.username}
Bio: ${profile.bio ?? profile.observacoes ?? "—"}
Nicho: ${profile.nicho ?? "—"}
Objetivo: ${profile.objetivo ?? "—"}
Frequência atual: ${profile.frequencia_conteudo ?? "não informada"}
Temas da marca: ${themes.join(", ")}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = safeJsonParse<Record<string, unknown>>(raw, {});

    const analysis: ProfileAnalysisResult = {
      summary: String(parsed.summary ?? fallback().summary),
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.map(String)
        : fallback().strengths,
      improvements: Array.isArray(parsed.improvements)
        ? parsed.improvements.map(String)
        : fallback().improvements,
      contentIdeas: Array.isArray(parsed.contentIdeas)
        ? parsed.contentIdeas.map(String)
        : fallback().contentIdeas,
      generatedAt: new Date().toISOString(),
    };

    const frequenciaRecomendada =
      typeof parsed.frequenciaRecomendada === "string"
        ? parsed.frequenciaRecomendada
        : null;

    await repo.update(profileId, {
      analise: analysis as unknown as Record<string, unknown>,
      ...(frequenciaRecomendada && !profile.frequencia_conteudo
        ? { frequencia_conteudo: frequenciaRecomendada }
        : {}),
    });

    return { analysis, error: null };
  } catch (error) {
    console.error("[social-analyze]", error);
    if (error instanceof APIError) {
      const analysis = fallback();
      await repo.update(profileId, { analise: analysis as unknown as Record<string, unknown> });
      return { analysis, error: null };
    }
    return { analysis: fallback(), error: "Erro ao analisar perfil." };
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
