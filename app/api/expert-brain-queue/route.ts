export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const requestedLimit = typeof body.limit === "number" ? body.limit : 5;
  const effectiveLimit = Math.max(1, Math.min(requestedLimit, 20));

  console.log("[queue] POST", { requestedLimit, effectiveLimit });

  const { processExpertBrainIngestionQueue } = await import(
    "@/lib/supabase/services/expert-brain-ingestion.service"
  );

  const result = await processExpertBrainIngestionQueue(effectiveLimit);

  if (result.error) {
    return Response.json(
      {
        success: false,
        error: result.error,
        found: result.found,
        processed: result.processed,
        failed: result.failed,
        message: result.message,
      },
      { status: result.error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  if (result.found === 0 || (result.processed === 0 && result.failed === 0)) {
    return Response.json({
      success: false,
      found: result.found,
      processed: result.processed,
      failed: result.failed,
      message: result.message ?? "Nenhum item processável encontrado",
    });
  }

  return Response.json({
    success: true,
    found: result.found,
    processed: result.processed,
    failed: result.failed,
    message: result.message,
  });
}
