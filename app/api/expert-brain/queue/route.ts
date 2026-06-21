import { processExpertBrainQueue } from "@/lib/supabase/services/expert-brain-dashboard.service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? Math.min(body.limit, 20) : 5;

    const { processed, failed, error } = await processExpertBrainQueue(limit);

    if (error) {
      return Response.json(
        { error },
        { status: error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    return Response.json({
      processed,
      failed,
      message:
        processed > 0 || failed > 0
          ? `Processados: ${processed} · Falhas: ${failed}`
          : "Fila vazia.",
    });
  } catch {
    return Response.json({ error: "Erro ao processar fila." }, { status: 500 });
  }
}
