import { sendPropostaByEmail } from "@/lib/comms";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      propostaId?: string;
      toEmail?: string;
      subject?: string;
      body?: string;
    }>(req);

    if (bodyError || !body?.propostaId || !body?.toEmail?.trim()) {
      return Response.json(
        { error: bodyError ?? "propostaId e toEmail são obrigatórios." },
        { status: 400 }
      );
    }

    const result = await sendPropostaByEmail({
      propostaId: body.propostaId,
      toEmail: body.toEmail.trim(),
      subject: body.subject,
      body: body.body,
    });

    if (result.error) {
      return Response.json({ error: result.error }, { status: 422 });
    }

    return Response.json({ ok: true, logId: result.logId });
  } catch (error) {
    console.error("[comms/send-proposta]", error);
    return Response.json({ error: "Erro ao enviar proposta." }, { status: 500 });
  }
}
