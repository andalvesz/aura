import { logOutboundMessage } from "@/lib/comms";
import type { Json } from "@/types/database";
import type { CommsChannel } from "@/utils/comms";
import { parseRequestJson } from "@/utils/safe-json";

const VALID_CHANNELS = new Set<CommsChannel>(["email", "whatsapp", "instagram"]);

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      channel?: string;
      bodyPreview?: string;
      recipient?: string;
      subject?: string;
      clienteId?: string;
      orcamentoId?: string;
      leadId?: string;
      propostaId?: string;
      metadata?: Record<string, unknown>;
    }>(req);

    if (bodyError || !body?.channel || !VALID_CHANNELS.has(body.channel as CommsChannel)) {
      return Response.json(
        { error: bodyError ?? "Canal inválido." },
        { status: 400 }
      );
    }

    const { data, error } = await logOutboundMessage({
      channel: body.channel as CommsChannel,
      status: "sent",
      subject: body.subject,
      bodyPreview: body.bodyPreview,
      recipient: body.recipient,
      clienteId: body.clienteId ?? null,
      orcamentoId: body.orcamentoId ?? null,
      leadId: body.leadId ?? null,
      propostaId: body.propostaId ?? null,
      metadata: (body.metadata ?? {}) as Json,
    });

    if (error) {
      const status = error === "Usuário não autenticado." ? 401 : 500;
      return Response.json({ error }, { status });
    }

    return Response.json({ log: data });
  } catch (error) {
    console.error("[comms/log] POST", error);
    return Response.json({ error: "Erro ao registrar contato." }, { status: 500 });
  }
}
