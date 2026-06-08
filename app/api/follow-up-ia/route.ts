import OpenAI, { APIError } from "openai";
import type { FollowUpChannel } from "@/utils/follow-up";
import { parseRequestJson } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHANNEL_HINTS: Record<FollowUpChannel, string> = {
  whatsapp:
    "Tom casual-profissional, parágrafos curtos, ideal para WhatsApp. Máx. 6 linhas.",
  instagram:
    "Tom leve para Instagram Direct, 2-4 frases, sem formalidade excessiva.",
  email:
    "Tom formal de e-mail com saudação, corpo e assinatura Anderson Alves · Alvesz Experience.",
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
  return "Erro ao gerar follow-up. Tente novamente.";
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      channel?: string;
      context?: {
        nome?: string;
        tipoEvento?: string;
        valor?: number;
        statusLabel?: string;
        idleDays?: number;
        historico?: string;
        clienteEmail?: string;
        telefone?: string;
        orcamentoId?: string;
        leadId?: string;
      };
      baseMessage?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const channel = body.channel as FollowUpChannel;
    if (!channel || !CHANNEL_HINTS[channel]) {
      return Response.json({ error: "Canal inválido." }, { status: 400 });
    }

    const ctx = body.context;
    if (!ctx?.nome?.trim()) {
      return Response.json({ error: "Contexto incompleto." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY não configurada." },
        { status: 503 }
      );
    }

    const valorFmt =
      typeof ctx.valor === "number"
        ? new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(ctx.valor)
        : "—";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Você escreve follow-ups comerciais para Anderson (Alvesz Experience).
Objetivo: profissional, persuasivo, premium, focado em fechamento.
${CHANNEL_HINTS[channel]}
Não invente valores ou datas. Use apenas os dados fornecidos.`,
        },
        {
          role: "user",
          content: `Reescreva o follow-up para ${channel}:

Cliente: ${ctx.nome}
Evento/tipo: ${ctx.tipoEvento ?? "evento"}
Valor: ${valorFmt}
Status: ${ctx.statusLabel ?? "—"}
Dias sem contato: ${ctx.idleDays ?? "—"}
E-mail: ${ctx.clienteEmail ?? "—"}
Telefone: ${ctx.telefone ?? "—"}
Orçamento ID: ${ctx.orcamentoId ?? "—"}
Lead ID: ${ctx.leadId ?? "—"}
Histórico: ${ctx.historico ?? "—"}

Rascunho base:
${body.baseMessage ?? ""}`,
        },
      ],
    });

    const message =
      response.choices[0]?.message?.content?.trim() ??
      "Não foi possível gerar a mensagem.";

    return Response.json({ message });
  } catch (error) {
    console.error("[follow-up-ia]", error);
    return Response.json({ error: resolveError(error) }, { status: 500 });
  }
}
