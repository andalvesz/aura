export async function POST(request: Request) {
  try {
    const { processExpertBrainIngestionQueue } = await import(
      "@/lib/supabase/services/expert-brain-ingestion.service"
    );

    const body = await request.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? Math.min(body.limit, 20) : 5;

    const result = await processExpertBrainIngestionQueue(limit);

    if (result.error) {
      return Response.json(
        { success: false, error: result.error, stack: null },
        { status: result.error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    return Response.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      message:
        result.processed > 0
          ? `Ingestão: ${result.processed} · Falhas: ${result.failed}`
          : "Filas vazias.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    console.error("[expert-brain-queue] error", { error: message, stack });
    return Response.json({ success: false, error: message, stack }, { status: 500 });
  }
}
