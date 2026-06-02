import OpenAI, { APIError } from "openai";
import { SOCIAL_ROTEIRO_CONTEXT } from "@/utils/social";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function resolveError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  return "Erro ao gerar roteiro. Tente novamente.";
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
    const plataforma = typeof body.plataforma === "string" ? body.plataforma : "instagram";
    const formato = typeof body.formato === "string" ? body.formato : "reels";
    const objetivo = typeof body.objetivo === "string" ? body.objetivo.trim() : "";

    if (!titulo) {
      return Response.json({ error: "Informe o título do conteúdo." }, { status: 400 });
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
        {
          role: "system",
          content: `Você cria roteiros de conteúdo para redes sociais.
${SOCIAL_ROTEIRO_CONTEXT}
Estruture: gancho, desenvolvimento, CTA, hashtags sugeridas. Seja prático e em português do Brasil.`,
        },
        {
          role: "user",
          content: `Crie um roteiro para:
Título: ${titulo}
Plataforma: ${plataforma}
Formato: ${formato}
Objetivo: ${objetivo || "Engajamento e conversão"}`,
        },
      ],
    });

    const roteiro =
      response.choices[0]?.message?.content ?? "Não foi possível gerar o roteiro.";

    return Response.json({ roteiro });
  } catch (error) {
    console.error("[social-roteiro]", error);
    return Response.json({ error: resolveError(error) }, { status: 500 });
  }
}
