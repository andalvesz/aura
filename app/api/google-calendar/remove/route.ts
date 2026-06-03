import { deleteEventoFromGoogle } from "@/lib/google-calendar";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      googleEventId?: string;
    }>(req);

    if (bodyError || !body?.googleEventId) {
      return Response.json({ error: "googleEventId obrigatório." }, { status: 400 });
    }

    const result = await deleteEventoFromGoogle({ google_event_id: body.googleEventId });

    if (result.error && !result.skipped) {
      return Response.json({ error: result.error }, { status: 422 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[google-calendar/remove]", error);
    return Response.json({ error: "Erro ao remover no Google." }, { status: 500 });
  }
}
