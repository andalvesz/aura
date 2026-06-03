import { pushEventoToGoogle } from "@/lib/google-calendar";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{ eventoId?: string }>(
      req
    );

    if (bodyError || !body?.eventoId) {
      return Response.json({ error: "eventoId obrigatório." }, { status: 400 });
    }

    const result = await pushEventoToGoogle(body.eventoId);

    if (result.skipped) {
      return Response.json({ ok: true, synced: false, skipped: true });
    }

    if (result.error) {
      return Response.json({ error: result.error, synced: false }, { status: 422 });
    }

    return Response.json({ ok: true, synced: result.synced });
  } catch (error) {
    console.error("[google-calendar/push]", error);
    return Response.json({ error: "Erro ao sincronizar evento." }, { status: 500 });
  }
}
