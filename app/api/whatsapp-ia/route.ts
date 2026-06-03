import OpenAI, { APIError } from "openai";
import type { WhatsAppIaContext, WhatsAppIntent } from "@/utils/whatsapp-ia";
import { buildDefaultWhatsAppMessage } from "@/utils/whatsapp-ia";
import { parseRequestJson } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const INTENT_HINTS: Record<WhatsAppIntent, string> = {
  lead:
    "Mensagem inicial ou retomada com lead. Tom profissional, humano e consultivo. Máx. 8 linhas.",
  proposta:
    "Resumo de proposta comercial Alvesz Experience para WhatsApp. Tom premium e profissional. Inclua valor, evento e próximos passos. Máx. 12 linhas.",
  followup:
    "Follow-up comercial. Tom profissional, humano, vendedor sem ser insistente. Máx. 6 linhas.",
};

function resolveError(error: unknown): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  return "Erro ao gerar mensagem. Tente novamente.";
}

function formatValor(valor: number | undefined): string {
  if (typeof valor !== "number" || !Number.isFinite(valor)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function buildUserPrompt(ctx: WhatsAppIaContext, baseMessage?: string): string {
  if (ctx.intent === "lead") {
    return `Gere mensagem WhatsApp para lead:

Nome: ${ctx.nome}
Interesse: ${ctx.interesse}
Status: ${ctx.statusLabel}
Valor: ${formatValor(ctx.valor)}
Último contato: há ${ctx.ultimoContatoDias} dia(s)
${ctx.historico ? `Notas: ${ctx.historico}` : ""}

${baseMessage ? `Rascunho base:\n${baseMessage}` : ""}`;
  }

  if (ctx.intent === "proposta") {
    return `Gere mensagem WhatsApp com proposta:

Cliente: ${ctx.nomeCliente}
Evento: ${ctx.evento}
Valor: ${formatValor(ctx.valor)}
Próximos passos: ${ctx.proximosPassos}
${ctx.pdfUrl ? `Link PDF: ${ctx.pdfUrl}` : ""}

${baseMessage ? `Rascunho base:\n${baseMessage}` : ""}`;
  }

  return `Gere follow-up WhatsApp:

Cliente: ${ctx.nome}
Evento/tipo: ${ctx.tipoEvento}
Valor: ${formatValor(ctx.valor)}
Status: ${ctx.statusLabel}
Dias sem contato: ${ctx.idleDays}
${ctx.historico ? `Histórico: ${ctx.historico}` : ""}

${baseMessage ? `Rascunho base:\n${baseMessage}` : ""}`;
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      intent?: WhatsAppIntent;
      context?: WhatsAppIaContext;
      baseMessage?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json(
        { error: bodyError ?? "Requisição inválida." },
        { status: 400 }
      );
    }

    const intent = body.intent;
    const ctx = body.context;

    if (!intent || !INTENT_HINTS[intent]) {
      return Response.json({ error: "Intent inválido." }, { status: 400 });
    }

    if (!ctx || ctx.intent !== intent) {
      return Response.json({ error: "Contexto incompleto." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      const fallback = buildDefaultWhatsAppMessage(ctx);
      return Response.json({
        message: fallback,
        fallback: true,
        error: "OPENAI_API_KEY não configurada. Usando modelo padrão.",
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você escreve mensagens para WhatsApp em português do Brasil para Anderson (Aura OS / Alvesz Experience).
${INTENT_HINTS[intent]}
Não invente valores, datas ou compromissos. Use apenas os dados fornecidos.
Sem markdown. Retorne só o texto da mensagem.`,
        },
        {
          role: "user",
          content: buildUserPrompt(ctx, body.baseMessage),
        },
      ],
    });

    const message =
      response.choices[0]?.message?.content?.trim() ??
      buildDefaultWhatsAppMessage(ctx);

    return Response.json({ message });
  } catch (error) {
    console.error("[whatsapp-ia]", error);
    return Response.json({ error: resolveError(error) }, { status: 500 });
  }
}
