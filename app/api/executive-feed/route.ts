import OpenAI, { APIError } from "openai";
import { getAuraGlobalSummaryMentorContext } from "@/lib/supabase/services/mentor.service";
import { parseRequestJson, safeJsonParse } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function resolveError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Créditos da OpenAI esgotados.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  return "IA indisponível no momento.";
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<Record<string, never>>(
      req
    );

    if (bodyError && bodyError !== "Corpo da requisição vazio.") {
      return Response.json({ error: bodyError }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ useFallback: true }, { status: 200 });
    }

    const { context, error: dataError } = await getAuraGlobalSummaryMentorContext();

    if (dataError === "Usuário não autenticado.") {
      return Response.json({ error: "Faça login." }, { status: 401 });
    }

    const systemPrompt = `Você gera o Feed Executivo da Aura OS para Anderson Alves.
Use EXCLUSIVAMENTE os dados reais abaixo. Nunca invente informações.

${context ?? "Nenhum dado disponível."}

Responda APENAS JSON:
{
  "items": [
    { "label": "Oportunidade principal da semana", "text": "string curta e acionável" },
    { "label": "Lead mais importante", "text": "string com nome e valor se houver" },
    { "label": "Conteúdo recomendado", "text": "string" },
    { "label": "Foco de saúde", "text": "string" }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: "Gere o feed executivo da Aura com base nos dados reais.",
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = safeJsonParse<{ items?: { label?: string; text?: string }[] }>(
      raw,
      {}
    );

    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((item) => item?.label && item?.text)
          .map((item) => ({
            label: String(item.label),
            text: String(item.text),
          }))
      : [];

    if (items.length === 0) {
      return Response.json({ useFallback: true });
    }

    return Response.json({ items });
  } catch (error) {
    console.error("[executive-feed]", error);
    return Response.json({ useFallback: true, error: resolveError(error) });
  }
}
