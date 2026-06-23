import { processExpertBrainIngestionQueue } from "@/lib/supabase/services/expert-brain-ingestion.service";
import { processExpertBrainQueue } from "@/lib/supabase/services/expert-brain-dashboard.service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? Math.min(body.limit, 20) : 5;

    const ingestResult = await processExpertBrainIngestionQueue(3);
    const { processed, failed, error } = await processExpertBrainQueue(limit);

    if (error) {
      return Response.json(
        { error },
        { status: error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    return Response.json({
      ingested: ingestResult.processed,
      processed,
      failed: failed + ingestResult.failed,
      message:
        processed > 0 || ingestResult.processed > 0
          ? `Ingestão: ${ingestResult.processed} · Extração: ${processed} · Falhas: ${failed + ingestResult.failed}`
          : "Filas vazias.",
    });
  } catch {
    return Response.json({ error: "Erro ao processar fila." }, { status: 500 });
  }
}
