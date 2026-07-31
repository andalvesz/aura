import OpenAI from "openai";
import { logOpenAiError } from "@/lib/logs/record";
import { parseRequestJson } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{ message?: string }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return Response.json(
        { error: "Mensagem não enviada." },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você é a Aura IA, assistente pessoal do usuário autenticado. Ajude com finanças pessoais, agenda, negócios, saúde, social media e crescimento digital usando somente o contexto do usuário atual. Nunca assuma perfil, lesões ou histórico de outra pessoa. Responda em português do Brasil, de forma objetiva, prática e estratégica.",
        },
        {
          role: "user",
          content: message,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "Não consegui responder.";

    return Response.json({ text });
  } catch (error) {
    console.error(error);
    logOpenAiError("aura", error, "/api/aura");

    return Response.json(
      { error: "Erro ao gerar resposta da Aura IA." },
      { status: 500 }
    );
  }
}