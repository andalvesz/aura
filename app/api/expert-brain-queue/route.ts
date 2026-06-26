import { jsonRouteError } from "@/utils/api-json-route";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedLimit = typeof body.limit === "number" ? body.limit : 5;
    const effectiveLimit = Math.max(1, Math.min(requestedLimit, 20));
    const action = typeof body.action === "string" ? body.action : "process";

    console.log("[expert-brain-queue] POST", { requestedLimit, effectiveLimit, action });

    const { processExpertBrainIngestionQueue, resetFailedDriveVideos } = await import(
      "@/lib/supabase/services/expert-brain-ingestion.service"
    );

    if (action === "reset_failed_drive") {
      const resetResult = await resetFailedDriveVideos();
      if (resetResult.error) {
        return Response.json(
          {
            success: false,
            error: resetResult.error,
            reset: resetResult.reset,
            scanned: resetResult.scanned,
          },
          { status: resetResult.error === "Usuário não autenticado." ? 401 : 500 }
        );
      }

      return Response.json({
        success: true,
        action,
        reset: resetResult.reset,
        scanned: resetResult.scanned,
        message:
          resetResult.reset > 0
            ? `${resetResult.reset} vídeo(s) do Drive reenfileirado(s) como pending_drive`
            : "Nenhum item failed de Storage do Drive para reprocessar",
      });
    }

    const result = await processExpertBrainIngestionQueue(effectiveLimit);

    if (result.error) {
      return Response.json(
        {
          success: false,
          error: result.error,
          found: result.found,
          processed: result.processed,
          completed: result.completed,
          failed: result.failed,
          skipped: result.skipped,
          message: result.message,
        },
        { status: result.error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    return Response.json({
      success: result.success,
      found: result.found,
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
      skipped: result.skipped,
      pendingDriveRemaining: result.pendingDriveRemaining,
      message: result.message,
    });
  } catch (error) {
    return jsonRouteError("expert-brain-queue", error);
  }
}
