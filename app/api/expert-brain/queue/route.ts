import {
  ExpertIngestionQueueRepository,
  ExpertProcessingQueueRepository,
} from "@/lib/supabase/repositories/expert-brain.repository";
import { processExpertBrainIngestionQueue } from "@/lib/supabase/services/expert-brain-ingestion.service";
import { processExpertBrainQueue } from "@/lib/supabase/services/expert-brain-dashboard.service";
import { getOptionalDataContext } from "@/lib/supabase/services/context";

function queueErrorResponse(error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack ?? null : null;
  console.error("[queue] error", { error: message, stack });
  return Response.json({ success: false, error: message, stack }, { status });
}

export async function POST(request: Request) {
  console.log("[queue] start");

  try {
    const body = await request.json().catch(() => ({}));
    const limit = typeof body.limit === "number" ? Math.min(body.limit, 20) : 5;
    const ingestLimit = Math.min(Math.max(limit, 3), 20);

    const ctx = await getOptionalDataContext();
    if (!ctx) {
      return Response.json(
        { success: false, error: "Usuário não autenticado.", stack: null },
        { status: 401 }
      );
    }

    const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
    const queueRepo = new ExpertProcessingQueueRepository(ctx.supabase, ctx.userId);

    const [{ data: ingestPending }, { data: processPending }] = await Promise.all([
      ingestionRepo.findWorkable(ingestLimit),
      queueRepo.findPending(limit),
    ]);

    const pendingCount = (ingestPending?.length ?? 0) + (processPending?.length ?? 0);
    console.log("[queue] pending", pendingCount);

    for (const item of ingestPending ?? []) {
      console.log("[queue] item", item.id, item.status);
    }
    for (const item of processPending ?? []) {
      console.log("[queue] item", item.id, item.status);
    }

    const ingestResult = await processExpertBrainIngestionQueue(ingestLimit);
    const { processed, failed, error } = await processExpertBrainQueue(limit);

    if (ingestResult.error) {
      return Response.json(
        { success: false, error: ingestResult.error, stack: null },
        { status: ingestResult.error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    if (error) {
      return Response.json(
        { success: false, error, stack: null },
        { status: error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    const totalFailed = failed + ingestResult.failed;
    const totalProcessed = processed + ingestResult.processed;

    return Response.json({
      success: true,
      ingested: ingestResult.processed,
      processed,
      failed: totalFailed,
      message:
        totalProcessed > 0
          ? `Ingestão: ${ingestResult.processed} · Extração: ${processed} · Falhas: ${totalFailed}`
          : "Filas vazias.",
    });
  } catch (err) {
    return queueErrorResponse(err);
  }
}
