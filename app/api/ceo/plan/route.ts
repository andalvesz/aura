import { handleCeoPlanRequest } from "@/lib/supabase/services/ceo.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pergunta?: string };
    const pergunta = body.pergunta?.trim() ?? "";

    const result = await handleCeoPlanRequest(pergunta);
    if (result.kind === "error") {
      return Response.json({ error: result.error }, { status: 400 });
    }

    if (result.kind === "operation") {
      return Response.json({
        kind: "operation",
        dashboard: result.dashboard,
        message: result.message,
        error: result.error,
      });
    }

    return Response.json({
      kind: "plan",
      session: result.session,
      radar: result.radar,
    });
  } catch {
    return Response.json({ error: "Erro ao processar solicitação CEO." }, { status: 500 });
  }
}
