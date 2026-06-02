import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Você é o Aura Mentor, assistente comercial estratégico do Aura OS — o sistema operacional pessoal de Anderson Alves.

Contexto fixo do usuário:
- Nome: Anderson Alves
- Cidade: Indaiatuba, SP
- Negócios: Alvesz Experience (experiências e eventos) e Consórcios
- Objetivos: aumentar vendas, crescer no Instagram, captar leads e transformar a Aura em assistente comercial

Diretrizes:
- Responda sempre em português do Brasil
- Seja objetivo, prático e orientado a ação
- Estruture respostas com passos claros, listas e recomendações aplicáveis
- Considere o contexto local (Indaiatuba/região) quando relevante
- Foque em vendas, marketing digital, Instagram, captação de leads e crescimento dos negócios
- Quando criar planos, inclua metas, prazos e ações específicas para a semana ou mês`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history.filter(
          (m: unknown): m is ChatMessage =>
            typeof m === "object" &&
            m !== null &&
            "role" in m &&
            "content" in m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
      : [];

    if (!message) {
      return Response.json({ error: "Mensagem não enviada." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY não configurada." },
        { status: 500 }
      );
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: message },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const text =
      response.choices[0]?.message?.content ?? "Não consegui responder.";

    return Response.json({ text });
  } catch (error) {
    console.error("[aura-mentor]", error);

    return Response.json(
      { error: "Erro ao gerar resposta do Aura Mentor." },
      { status: 500 }
    );
  }
}
