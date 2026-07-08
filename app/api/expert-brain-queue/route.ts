import { getOptionalDataContext } from "@/lib/supabase/services/context";
import { ExpertIngestionQueueRepository } from "@/lib/supabase/repositories/expert-brain.repository";

function fatalJson(error: unknown, status = 500): Response {
  console.error("[expert-brain-queue] fatal", error);
  const err = error instanceof Error ? error : new Error(String(error));
  return Response.json(
    {
      success: false,
      error: err.message,
      name: err.name,
      stack: err.stack ?? null,
    },
    { status }
  );
}

function readItemSource(
  item: {
    file_path: string;
    metadata: unknown;
  } | null
): string | null {
  if (!item) return null;
  if (typeof item.metadata === "object" && item.metadata && !Array.isArray(item.metadata)) {
    const meta = item.metadata as Record<string, unknown>;
    if (typeof meta.source === "string") return meta.source;
    if (typeof meta.drive_file_id === "string") return "google_drive";
  }
  if (item.file_path.startsWith("drive:")) return "google_drive";
  return "storage";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const requestedLimit = typeof body.limit === "number" ? body.limit : 5;
    const effectiveLimit = Math.max(1, Math.min(requestedLimit, 20));
    const action = typeof body.action === "string" ? body.action : "process";

    let userId: string | null = null;
    try {
      const ctx = await getOptionalDataContext();
      userId = ctx?.userId ?? null;
    } catch (authError) {
      console.error("[expert-brain-queue] fatal", authError);
      return fatalJson(authError);
    }

    console.info("[expert-brain-queue] POST", {
      action,
      userId,
      requestedLimit,
      effectiveLimit,
    });

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
            name: "ExpertBrainQueueError",
            stack: null,
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

    if (userId) {
      try {
        const ctx = await getOptionalDataContext();
        if (ctx) {
          const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
          const { data: pendingItems, error: pendingError } =
            await ingestionRepo.findWorkable(effectiveLimit);

          const first = pendingItems?.[0] ?? null;
          console.info("[expert-brain-queue] pending items", {
            action,
            userId,
            pendingError,
            found: pendingItems?.length ?? 0,
            firstItem: first
              ? {
                  id: first.id,
                  status: first.status,
                  source: readItemSource(first),
                  fileName: first.file_name,
                  filePath: first.file_path,
                  metadata: first.metadata,
                }
              : null,
          });
        }
      } catch (preflightError) {
        console.error("[expert-brain-queue] preflight log failed", preflightError);
      }
    }

    console.info("[expert-brain-queue] before processExpertBrainIngestionQueue", {
      action,
      userId,
      effectiveLimit,
    });

    const result = await processExpertBrainIngestionQueue(effectiveLimit);

    console.info("[expert-brain-queue] after processExpertBrainIngestionQueue", {
      action,
      userId,
      success: result.success,
      found: result.found,
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
      skipped: result.skipped,
      error: result.error,
      message: result.message,
    });

    if (result.error) {
      return Response.json(
        {
          success: false,
          error: result.error,
          name: "ExpertBrainQueueError",
          stack: null,
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
    return fatalJson(error);
  }
}
