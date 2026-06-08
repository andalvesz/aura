import { injectIdentityIntoPrompt } from "@/lib/ai/identity-runtime";
import OpenAI, { APIError } from "openai";
import type { InstagramMarca } from "@/types/database";
import { MARCA_LABELS } from "@/utils/instagram";
import {
  SOCIAL_ROTEIRO_CONTEXT,
  getFormatoLabel,
  getPlataformaLabel,
  normalizeConteudoFormato,
} from "@/utils/social";
import { safeJsonParse } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export function assertOpenAiAvailable(): string | null {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return "IA indisponível. Configure OPENAI_API_KEY para usar recursos de IA.";
  }
  return null;
}

export function resolveSocialRoteiroError(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

type GenerateSocialRoteiroParams = {
  titulo: string;
  plataforma?: string;
  formato?: string;
  objetivo?: string;
  marca?: InstagramMarca | null;
  message?: string;
};

export async function generateSocialRoteiro(
  params: GenerateSocialRoteiroParams
): Promise<{ roteiro: string; suggestion: Record<string, unknown> }> {
  const titulo = params.titulo.trim();
  const plataforma = params.plataforma ?? "instagram";
  const formato = normalizeConteudoFormato(params.formato ?? null);
  const objetivo = params.objetivo?.trim() ?? "";

  const marcaSection = params.marca
    ? `\nMarca ativa: ${MARCA_LABELS[params.marca]}.`
    : "";

  const systemPrompt = await injectIdentityIntoPrompt(`${SOCIAL_ROTEIRO_CONTEXT}${marcaSection}

Responda APENAS JSON:
{
  "roteiro": "roteiro completo com gancho, desenvolvimento, CTA e hashtags",
  "titulo": "string",
  "plataforma": "string",
  "formato": "string",
  "hashtags": ["string"]
}`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Crie roteiro para:
Título: ${titulo}
Plataforma: ${getPlataformaLabel(plataforma)}
Formato: ${getFormatoLabel(formato)}
${objetivo ? `Objetivo: ${objetivo}` : ""}`,
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = safeJsonParse<Record<string, unknown>>(raw, {});
  const roteiro = String(parsed.roteiro ?? raw).trim();

  return {
    roteiro,
    suggestion: {
      ...parsed,
      roteiro,
      titulo,
      plataforma,
      formato,
    },
  };
}
