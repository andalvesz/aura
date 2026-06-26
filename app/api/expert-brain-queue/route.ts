export async function POST(request: Request) {
  console.log("[queue] start POST");

  let body: { limit?: number } = {};

  try {
    console.log("[queue] before parse request body");
    body = await request.json().catch(() => ({}));
    console.log("[queue] finished parse request body");
  } catch (err) {
    console.error("FAILED parse request body", err);
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    return Response.json(
      { success: false, error: message, stack, step: "parse request body" },
      { status: 500 }
    );
  }

  const limit = typeof body.limit === "number" ? Math.min(body.limit, 20) : 5;

  let processExpertBrainIngestionQueue: (
    limit?: number
  ) => Promise<{ processed: number; failed: number; error: string | null }>;

  try {
    console.log("[queue] before import expert-brain-ingestion.service");
    ({ processExpertBrainIngestionQueue } = await import(
      "@/lib/supabase/services/expert-brain-ingestion.service"
    ));
    console.log("[queue] imported expert-brain-ingestion.service");
  } catch (err) {
    console.error("FAILED import expert-brain-ingestion.service", err);
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    return Response.json(
      { success: false, error: message, stack, step: "import expert-brain-ingestion.service" },
      { status: 500 }
    );
  }

  let result: { processed: number; failed: number; error: string | null };

  try {
    console.log("[queue] before processExpertBrainIngestionQueue", { limit });
    result = await processExpertBrainIngestionQueue(limit);
    console.log("[queue] finished processExpertBrainIngestionQueue", result);
  } catch (err) {
    console.error("FAILED processExpertBrainIngestionQueue", err);
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    return Response.json(
      { success: false, error: message, stack, step: "processExpertBrainIngestionQueue" },
      { status: 500 }
    );
  }

  try {
    console.log("[queue] before build response");

    if (result.error) {
      console.log("[queue] finished build response (error)", { error: result.error });
      return Response.json(
        { success: false, error: result.error, stack: null, step: "processExpertBrainIngestionQueue result" },
        { status: result.error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    const response = {
      success: true,
      processed: result.processed,
      failed: result.failed,
      message:
        result.processed > 0
          ? `Ingestão: ${result.processed} · Falhas: ${result.failed}`
          : "Filas vazias.",
    };

    console.log("[queue] finished build response", response);
    return Response.json(response);
  } catch (err) {
    console.error("FAILED build response", err);
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack ?? null : null;
    return Response.json(
      { success: false, error: message, stack, step: "build response" },
      { status: 500 }
    );
  }
}
