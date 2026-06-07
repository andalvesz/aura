import OpenAI, { APIError } from "openai";
import { persistAiTurn } from "@/lib/ai/memory-runtime";
import { logCalendarFailure, logOpenAiError } from "@/lib/logs/record";
import type { ParsedEventoSuggestion } from "@/utils/calendar";
import { parseRequestJson, safeJsonParse } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM = `Você interpreta pedidos de agenda em português do Brasil.
Responda APENAS com JSON válido (sem markdown), no formato:
{
  "titulo": "string",
  "descricao": "string ou null",
  "data": "YYYY-MM-DD",
  "hora": "HH:MM",
  "tipo": "geral|reuniao|evento|followup|social"
}
Use a data de hoje como referência quando o usuário disser amanhã, próxima semana, etc.
Hora padrão 09:00 se não informada.`;

function resolveMentorError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos. Cadastre o evento manualmente.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida. Cadastre o evento manualmente.";
    }
  }
  return "Não foi possível interpretar o pedido. Cadastre o evento manualmente.";
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{ message?: string }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return Response.json({ error: "Descreva o compromisso." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      logOpenAiError("calendario", "OPENAI_API_KEY ausente", "/api/calendar-agenda");
      return Response.json(
        {
          error:
            "IA indisponível (OPENAI_API_KEY). Use o botão Novo evento para cadastrar manualmente.",
        },
        { status: 503 }
      );
    }

    const hoje = new Date().toISOString().slice(0, 10);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${SYSTEM}\nData de hoje: ${hoje}` },
        { role: "user", content: message },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const parsed = safeJsonParse<Partial<ParsedEventoSuggestion>>(raw, {});

    if (!parsed.titulo || !parsed.data) {
      return Response.json(
        { error: "Não entendi o compromisso. Tente reformular ou cadastre manualmente." },
        { status: 422 }
      );
    }

    const suggestion: ParsedEventoSuggestion = {
      titulo: String(parsed.titulo).trim(),
      descricao: parsed.descricao ? String(parsed.descricao).trim() : null,
      data: String(parsed.data).slice(0, 10),
      hora: parsed.hora ? String(parsed.hora).slice(0, 5) : "09:00",
      tipo: parsed.tipo ?? "geral",
    };

    const assistantText = `Evento sugerido: ${suggestion.titulo} em ${suggestion.data} às ${suggestion.hora}`;
    await persistAiTurn("agenda", message, assistantText, { suggestion });

    return Response.json({ suggestion });
  } catch (error) {
    console.error("[calendar-agenda]", error);
    logCalendarFailure(error);
    logOpenAiError("calendario", error, "/api/calendar-agenda");
    return Response.json({ error: resolveMentorError(error) }, { status: 500 });
  }
}
