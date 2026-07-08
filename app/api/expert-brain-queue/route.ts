import { getOptionalDataContext } from "@/lib/supabase/services/context";
import { ExpertIngestionQueueRepository } from "@/lib/supabase/repositories/expert-brain.repository";
import {
  EXPERT_BRAIN_FILES_BUCKET,
  EXPERT_BRAIN_TRANSCRIPTS_BUCKET,
} from "@/utils/expert-brain-storage";

function jsonError(
  step: string,
  error: unknown,
  extra: Record<string, unknown> = {}
): Response {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : null;
  console.error("[expert-brain-queue] error", { step, message, stack, ...extra });
  return Response.json(
    {
      success: false,
      step,
      error: message,
      stack,
      memorySafe: true,
      ...extra,
    },
    { status: 500 }
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
    if (typeof meta.drive_file_id === "string" || typeof meta.driveFileId === "string") {
      return "google_drive";
    }
  }
  if (item.file_path.startsWith("drive:") || item.file_path.startsWith("google-drive://")) {
    return "google_drive";
  }
  return "storage";
}

function metadataKeys(metadata: unknown): string[] {
  if (typeof metadata === "object" && metadata && !Array.isArray(metadata)) {
    return Object.keys(metadata as Record<string, unknown>);
  }
  return [];
}

const REQUIRED_TABLES = [
  "expert_ingestion_queue",
  "expert_knowledge_sources",
  "expert_frameworks",
  "expert_decision_rules",
  "expert_success_patterns",
  "expert_failure_patterns",
  "expert_transcripts",
] as const;

const REQUIRED_BUCKETS = [EXPERT_BRAIN_FILES_BUCKET, EXPERT_BRAIN_TRANSCRIPTS_BUCKET] as const;

async function assertExpertBrainInfrastructure(
  supabase: Awaited<ReturnType<typeof getOptionalDataContext>> extends infer T
    ? T extends { supabase: infer S }
      ? S
      : never
    : never
): Promise<{ ok: true } | { ok: false; missing: string }> {
  for (const table of REQUIRED_TABLES) {
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("does not exist") ||
        msg.includes("could not find") ||
        msg.includes("schema cache") ||
        error.code === "42P01" ||
        error.code === "PGRST205"
      ) {
        return { ok: false, missing: `Missing table/bucket: ${table}` };
      }
      // Other query errors (RLS, etc.) — don’t block, but log
      console.warn("[expert-brain-queue] table probe warning", { table, error: error.message });
    }
  }

  for (const bucket of REQUIRED_BUCKETS) {
    const { error } = await supabase.storage.from(bucket).list("", { limit: 1 });
    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("not found") ||
        msg.includes("does not exist") ||
        (msg.includes("bucket") && msg.includes("not"))
      ) {
        return { ok: false, missing: `Missing table/bucket: ${bucket}` };
      }
      console.warn("[expert-brain-queue] bucket probe warning", { bucket, error: error.message });
    }
  }

  return { ok: true };
}

function classifyDbError(message: string): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("expert_ingestion_queue_status_check") ||
    (lower.includes("violates check constraint") && lower.includes("status"))
  ) {
    return (
      "Status constraint rejeitou valor AIF v2. Rode a migration " +
      "20260708140000_expert_ingestion_queue_aif_v2_statuses.sql no Supabase."
    );
  }
  if (lower.includes("does not exist") || lower.includes("could not find the table")) {
    return `Missing table/bucket: ${message}`;
  }
  return message;
}

export async function POST(request: Request) {
  let step = "parse_body";
  let itemId: string | null = null;
  let itemStatus: string | null = null;
  let fileName: string | null = null;
  let source: string | null = null;

  try {
    let body: Record<string, unknown> = {};
    try {
      step = "parse_body";
      body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    } catch (error) {
      return jsonError("parse_body", error);
    }

    const requestedLimit = typeof body.limit === "number" ? body.limit : 1;
    const effectiveLimit = Math.max(1, Math.min(requestedLimit, 3));
    const action = typeof body.action === "string" ? body.action : "process";

    let ctx: Awaited<ReturnType<typeof getOptionalDataContext>> = null;
    try {
      step = "get_user";
      ctx = await getOptionalDataContext();
    } catch (error) {
      return jsonError("get_user", error, { requestedLimit: effectiveLimit });
    }

    const userId = ctx?.userId ?? null;
    console.log("[expert-brain-queue]", {
      step: "get_user",
      userId,
      action,
      limit: effectiveLimit,
    });

    if (!ctx || !userId) {
      return Response.json(
        {
          success: false,
          step: "get_user",
          error: "Usuário não autenticado.",
          stack: null,
          memorySafe: true,
        },
        { status: 401 }
      );
    }

    try {
      step = "create_supabase_client";
      const infra = await assertExpertBrainInfrastructure(ctx.supabase);
      if (!infra.ok) {
        return jsonError("create_supabase_client", new Error(infra.missing), {
          userId,
          missing: infra.missing,
        });
      }
    } catch (error) {
      return jsonError("create_supabase_client", error, { userId });
    }

    let processExpertBrainIngestionQueue: typeof import(
      "@/lib/supabase/services/expert-brain-ingestion.service"
    ).processExpertBrainIngestionQueue;
    let resetFailedDriveVideos: typeof import(
      "@/lib/supabase/services/expert-brain-ingestion.service"
    ).resetFailedDriveVideos;

    try {
      step = "process_queue_start";
      const mod = await import("@/lib/supabase/services/expert-brain-ingestion.service");
      processExpertBrainIngestionQueue = mod.processExpertBrainIngestionQueue;
      resetFailedDriveVideos = mod.resetFailedDriveVideos;
    } catch (error) {
      return jsonError("process_queue_start", error, {
        note: "Falha ao importar expert-brain-ingestion.service",
      });
    }

    if (action === "reset_failed_drive") {
      try {
        const resetResult = await resetFailedDriveVideos();
        if (resetResult.error) {
          return jsonError("reset_failed_drive", new Error(resetResult.error), {
            reset: resetResult.reset,
            scanned: resetResult.scanned,
          });
        }
        return Response.json({
          success: true,
          step: "response",
          action,
          reset: resetResult.reset,
          scanned: resetResult.scanned,
          memorySafe: true,
          message:
            resetResult.reset > 0
              ? `${resetResult.reset} vídeo(s) do Drive reenfileirado(s) como pending_drive`
              : "Nenhum item failed de Storage do Drive para reprocessar",
        });
      } catch (error) {
        return jsonError("reset_failed_drive", error);
      }
    }

    let first: {
      id: string;
      status: string;
      file_name: string | null;
      file_path: string;
      metadata: unknown;
    } | null = null;

    try {
      step = "list_pending_items";
      const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
      const { data: pendingItems, error: pendingError } =
        await ingestionRepo.findWorkable(effectiveLimit);

      if (pendingError) {
        return jsonError(
          "list_pending_items",
          new Error(classifyDbError(pendingError)),
          { pendingError }
        );
      }

      step = "select_first_item";
      first = pendingItems?.[0] ?? null;
      itemId = first?.id ?? null;
      itemStatus = first?.status ?? null;
      fileName = first?.file_name ?? null;
      source = readItemSource(first);

      console.log("[expert-brain-queue]", {
        step: "select_first_item",
        itemId,
        status: itemStatus,
        fileName,
        source,
        metadataKeys: first ? metadataKeys(first.metadata) : [],
        limit: effectiveLimit,
        found: pendingItems?.length ?? 0,
      });
    } catch (error) {
      return jsonError(step === "select_first_item" ? "select_first_item" : "list_pending_items", error, {
        itemId,
        status: itemStatus,
      });
    }

    console.log("[expert-brain-queue]", {
      step: "process_queue_start",
      itemId,
      status: itemStatus,
      fileName,
      source,
      metadataKeys: first ? metadataKeys(first.metadata) : [],
      limit: effectiveLimit,
    });

    let result: Awaited<ReturnType<typeof processExpertBrainIngestionQueue>>;
    try {
      step = "process_aif_step";
      result = await processExpertBrainIngestionQueue(effectiveLimit);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonError("process_aif_step", error, {
        itemId,
        status: itemStatus,
        fileName,
        source,
        classified: classifyDbError(message),
      });
    }

    console.log("[expert-brain-queue]", {
      step: "process_aif_step_done",
      itemId,
      status: itemStatus,
      fileName,
      source,
      success: result.success,
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
      error: result.error,
      limit: effectiveLimit,
    });

    const remaining =
      (result.pendingDriveRemaining ?? 0) +
      Math.max(0, (result.found ?? 0) - (result.processed ?? 0));

    if (result.error) {
      const classified = classifyDbError(result.error);
      return jsonError("update_item", new Error(classified), {
        found: result.found,
        processed: result.processed,
        completed: result.completed,
        failed: result.failed,
        skipped: result.skipped,
        remaining,
        message: result.message,
        itemId,
        status: itemStatus,
        fileName,
        source,
        originalError: result.error,
      });
    }

    step = "response";
    return Response.json({
      success: result.success,
      step: "response",
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
      remaining,
      found: result.found,
      skipped: result.skipped,
      pendingDriveRemaining: result.pendingDriveRemaining,
      message: result.message,
      memorySafe: true,
      itemId,
      status: itemStatus,
      fileName,
      source,
    });
  } catch (error) {
    return jsonError(step || "response", error, {
      itemId,
      status: itemStatus,
      fileName,
      source,
    });
  }
}
