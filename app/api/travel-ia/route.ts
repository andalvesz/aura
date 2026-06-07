import OpenAI, { APIError } from "openai";
import { persistAiTurn } from "@/lib/ai/memory-runtime";
import { logOpenAiError } from "@/lib/logs/record";
import { parseTravelAiResponse, type ParsedTravelAiResponse } from "@/utils/travel";
import { parseRequestJson, safeJsonParse } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM = `Você é o assistente Aura Travel para planejar viagens em português do Brasil.
Responda APENAS com JSON válido (sem markdown), no formato:
{
  "roteiro": [{ "dia": 1, "titulo": "string", "atividades": ["string"] }],
  "checklist": [{ "categoria": "documentos|passaporte|visto|ingressos|hospedagem|seguro|transporte", "titulo": "string" }],
  "estimativa_custos": [{ "item": "string", "valor": 0 }],
  "preparacao": ["string"],
  "dicas": ["string"]
}
Gere roteiro dia a dia, checklist prático, estimativa de custos em BRL, preparação e dicas úteis.`;

function resolveTravelError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  return "Não foi possível gerar o plano de viagem.";
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      message?: string;
      destino?: string;
      data_ida?: string;
      data_volta?: string;
      orcamento?: number;
      template_id?: string | null;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return Response.json({ error: "Descreva a viagem que deseja planejar." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      logOpenAiError("calendario", "OPENAI_API_KEY ausente", "/api/travel-ia");
      return Response.json({ error: "IA indisponível (OPENAI_API_KEY)." }, { status: 503 });
    }

    const context = [
      body.destino ? `Destino: ${body.destino}` : null,
      body.data_ida && body.data_volta
        ? `Datas: ${body.data_ida} a ${body.data_volta}`
        : null,
      body.orcamento ? `Orçamento: R$ ${body.orcamento}` : null,
      body.template_id ? `Template: ${body.template_id}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: context ? `${context}\n\nPedido: ${message}` : message,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const parsed = parseTravelAiResponse(
      safeJsonParse<Partial<ParsedTravelAiResponse>>(raw, {})
    );

    if (!parsed.roteiro.length && !parsed.checklist.length) {
      return Response.json(
        { error: "Não foi possível gerar o plano. Tente reformular." },
        { status: 422 }
      );
    }

    const assistantText = `Plano gerado: ${parsed.roteiro.length} dias, ${parsed.checklist.length} itens no checklist.`;
    await persistAiTurn("agenda", message, assistantText, { travel: parsed });

    return Response.json({ plan: parsed });
  } catch (error) {
    console.error("[travel-ia]", error);
    logOpenAiError("calendario", error, "/api/travel-ia");
    return Response.json({ error: resolveTravelError(error) }, { status: 500 });
  }
}
