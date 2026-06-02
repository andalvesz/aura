import OpenAI, { APIError } from "openai";
import { HEALTH_COACH_CONTEXT } from "@/utils/health";
import { parseRequestJson, safeJsonParse } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function resolveError(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos. Use o cadastro manual.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida. Use o cadastro manual.";
    }
  }
  return fallback;
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      message?: string;
      mode?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    const mode = typeof body.mode === "string" ? body.mode : "chat";

    if (!message) {
      return Response.json({ error: "Descreva o que você precisa." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        {
          error:
            "IA indisponível (OPENAI_API_KEY). Cadastre hábitos, treinos e refeições manualmente.",
        },
        { status: 503 }
      );
    }

    if (mode === "treino") {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${HEALTH_COACH_CONTEXT}
Responda APENAS JSON:
{
  "nome": "string",
  "grupo_muscular": "string",
  "duracao_min": number,
  "exercicios": [{"nome":"string","series":"string","reps":"string","observacao":"string"}],
  "observacoes": "string ou null"
}
Evite exercícios que sobrecarreguem ombro lesionado.`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse(raw, {} as Record<string, unknown>);

      if (!parsed.nome) {
        return Response.json(
          { error: "Não foi possível montar o treino. Tente reformular ou cadastre manualmente." },
          { status: 422 }
        );
      }

      return Response.json({ suggestion: parsed, kind: "treino" });
    }

    if (mode === "dieta") {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${HEALTH_COACH_CONTEXT}
Responda APENAS JSON:
{
  "resumo": "string",
  "refeicoes": [
    {"nome":"string","horario":"HH:MM","alimentos":"string","calorias":number|null,"observacoes":"string|null"}
  ]
}
Sugestões alimentares gerais, sem prescrição médica.`,
          },
          { role: "user", content: message },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "{}";
      const parsed = safeJsonParse(raw, { refeicoes: [] } as Record<string, unknown>);

      if (!Array.isArray(parsed.refeicoes) || parsed.refeicoes.length === 0) {
        return Response.json(
          { error: "Não foi possível montar a dieta. Tente reformular ou cadastre manualmente." },
          { status: 422 }
        );
      }

      return Response.json({ suggestion: parsed, kind: "dieta" });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `${HEALTH_COACH_CONTEXT}
Você é a Aura Saúde. Responda em português do Brasil, com plano prático e seguro.
Para lesão no ombro: cuidado, progressão leve, encaminhar a profissional se houver dor.`,
        },
        { role: "user", content: message },
      ],
    });

    const text =
      response.choices[0]?.message?.content ??
      "Não consegui responder. Tente cadastrar manualmente.";

    return Response.json({ text, kind: "chat" });
  } catch (error) {
    console.error("[health-coach]", error);
    return Response.json(
      { error: resolveError(error, "Erro ao consultar a Aura Saúde.") },
      { status: 500 }
    );
  }
}
