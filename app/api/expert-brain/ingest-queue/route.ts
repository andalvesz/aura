import { getExpertBrainIngestionStatus, processExpertBrainIngestionQueue } from "@/lib/supabase/services/expert-brain-ingestion.service";
import { processExpertBrainQueue } from "@/lib/supabase/services/expert-brain-dashboard.service";

export async function GET() {
  const { items, pending, processing, error } = await getExpertBrainIngestionStatus();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ items, pending, processing });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? Math.min(body.limit, 10) : 3;

    const ingestResult = await processExpertBrainIngestionQueue(limit);
    const processResult =
      ingestResult.processed > 0
        ? await processExpertBrainQueue(Math.max(ingestResult.processed * 2, 5))
        : { processed: 0, failed: 0, error: null };

    if (ingestResult.error) {
      return Response.json(
        { error: ingestResult.error },
        { status: ingestResult.error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    return Response.json({
      ingested: ingestResult.processed,
      ingestFailed: ingestResult.failed,
      extracted: processResult.processed,
      extractFailed: processResult.failed,
      message: `Ingestão: ${ingestResult.processed} ok · Extração: ${processResult.processed} ok`,
    });
  } catch {
    return Response.json({ error: "Erro ao processar fila de ingestão." }, { status: 500 });
  }
}
