import OpenAI, { APIError } from "openai";
import { parseRequestJson } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Você é redator comercial da Alvesz Experience (bartender e eventos premium).
Reescreva a proposta recebida mantendo TODOS os dados factuais (cliente, datas, valores, local, convidados).
Objetivo: tom mais profissional, persuasivo, premium e focado em fechamento.
Use português do Brasil. Mantenha seções claras. Não invente valores ou datas.
Pode usar emojis com moderação (máx. 3). Termine com CTA de fechamento objetivo.`;

function resolveError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  return "Erro ao melhorar proposta. Tente novamente.";
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      proposta?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const proposta = typeof body.proposta === "string" ? body.proposta.trim() : "";
    if (!proposta) {
      return Response.json({ error: "Proposta vazia." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY não configurada." },
        { status: 503 }
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Melhore esta proposta comercial para fechamento:\n\n${proposta}`,
        },
      ],
    });

    const conteudo =
      response.choices[0]?.message?.content?.trim() ??
      "Não foi possível melhorar a proposta.";

    return Response.json({ conteudo });
  } catch (error) {
    console.error("[alvesz-proposta-ia]", error);
    return Response.json({ error: resolveError(error) }, { status: 500 });
  }
}
