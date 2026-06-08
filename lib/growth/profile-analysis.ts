import OpenAI, { APIError } from "openai";
import type { GrowthProfile } from "@/types/database";
import type { ProfileAnalysisResult } from "@/lib/growth/types";
import { getMarcaThemes, MARCA_LABELS } from "@/utils/instagram";
import type { InstagramMarca } from "@/types/database";
import { safeJsonParse } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function fallbackProfileAnalysis(profile: GrowthProfile): ProfileAnalysisResult {
  const marca = (profile.marca ?? "marca_pessoal") as InstagramMarca;
  const themes = getMarcaThemes(marca);
  const nicho = profile.nicho ?? themes.join(", ");
  const bio = profile.bio ?? profile.observacoes ?? "não informada";

  return {
    summary: `Perfil @${profile.username.replace(/^@/, "")} (${profile.plataforma}) no nicho ${nicho}.`,
    strengths: [
      profile.objetivo ? `Objetivo definido: ${profile.objetivo}` : "Objetivo cadastrado no perfil",
      `Bio e posicionamento em ${MARCA_LABELS[marca] ?? profile.plataforma}`,
    ],
    weaknesses: [
      profile.frequencia_conteudo
        ? `Frequência atual (${profile.frequencia_conteudo}) pode ser otimizada`
        : "Frequência de conteúdo não definida",
      "Falta diversificação de formatos (Reels, Stories, carrossel)",
    ],
    opportunities: [
      `Criar série de conteúdo sobre ${themes[0] ?? nicho}`,
      "Converter seguidores em leads com CTA claro na bio",
      "Reaproveitar conteúdo em múltiplos formatos",
    ],
    actionPlan: [
      "Revisar bio com proposta de valor e CTA",
      "Definir calendário semanal de publicações",
      "Publicar 3 Reels esta semana sobre o nicho",
      "Medir engajamento e ajustar temas",
    ],
    contentIdeas: themes.map((t) => `Conteúdo sobre ${t}`),
    generatedAt: new Date().toISOString(),
  };
}

function parseAnalysisResponse(
  parsed: Record<string, unknown>,
  fallback: ProfileAnalysisResult
): ProfileAnalysisResult {
  const toStrings = (key: string, altKey?: string): string[] => {
    const raw = parsed[key] ?? (altKey ? parsed[altKey] : undefined);
    return Array.isArray(raw) ? raw.map(String) : [];
  };

  const strengths = toStrings("strengths", "pontosFortes");
  const weaknesses = toStrings("weaknesses", "pontosFracos");
  const opportunities = toStrings("opportunities", "oportunidades");
  const actionPlan = toStrings("actionPlan", "planoAcao");
  const improvements = toStrings("improvements");
  const contentIdeas = toStrings("contentIdeas");

  return {
    summary: String(parsed.summary ?? fallback.summary),
    strengths: strengths.length > 0 ? strengths : fallback.strengths,
    weaknesses:
      weaknesses.length > 0
        ? weaknesses
        : improvements.length > 0
          ? improvements
          : fallback.weaknesses,
    opportunities: opportunities.length > 0 ? opportunities : fallback.opportunities,
    actionPlan: actionPlan.length > 0 ? actionPlan : fallback.actionPlan,
    contentIdeas: contentIdeas.length > 0 ? contentIdeas : fallback.contentIdeas,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateProfileAnalysis(
  profile: GrowthProfile
): Promise<{ analysis: ProfileAnalysisResult; usedAi: boolean }> {
  const fallback = fallbackProfileAnalysis(profile);

  if (!process.env.OPENAI_API_KEY) {
    return { analysis: fallback, usedAi: false };
  }

  const marca = (profile.marca ?? "marca_pessoal") as InstagramMarca;
  const themes = getMarcaThemes(marca);
  const bio = profile.bio ?? profile.observacoes ?? "—";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é estrategista de crescimento digital. Analise perfis em português do Brasil.
Responda APENAS JSON válido:
{
  "summary": "resumo executivo em 2-3 frases",
  "strengths": ["ponto forte 1", "ponto forte 2"],
  "weaknesses": ["ponto fraco 1", "ponto fraco 2"],
  "opportunities": ["oportunidade 1", "oportunidade 2"],
  "actionPlan": ["ação 1", "ação 2", "ação 3"],
  "contentIdeas": ["ideia de conteúdo 1", "ideia 2"]
}
Seja específico ao nicho, bio e objetivo informados.`,
        },
        {
          role: "user",
          content: `Plataforma: ${profile.plataforma}
Username: @${profile.username.replace(/^@/, "")}
Bio: ${bio}
Nicho: ${profile.nicho ?? "—"}
Objetivo: ${profile.objetivo ?? "—"}
Observações: ${profile.observacoes ?? "—"}
Frequência atual: ${profile.frequencia_conteudo ?? "não informada"}
Marca: ${profile.marca ? MARCA_LABELS[marca] : "—"}
Temas sugeridos: ${themes.join(", ")}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
    return { analysis: parseAnalysisResponse(parsed, fallback), usedAi: true };
  } catch (error) {
    console.error("[profile-analysis]", error);
    if (error instanceof APIError) {
      return { analysis: fallback, usedAi: false };
    }
    throw error;
  }
}
