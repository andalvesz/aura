import { NextResponse } from "next/server";

/**
 * FATAL-safe Expert Brain queue route.
 * NO app-local static imports — they crash the Function before POST can return JSON.
 * Every dependency is dynamically imported inside the outer try/catch.
 */

type QueueCtx = {
  userId: string;
  supabase: {
    from: (table: string) => {
      select: (
        cols: string
      ) => {
        limit: (n: number) => Promise<{ error: { message: string; code?: string } | null }>;
      };
    };
    storage: {
      from: (bucket: string) => {
        list: (
          path: string,
          opts: { limit: number }
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

function fatalJson(err: unknown, extra: Record<string, unknown> = {}) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : null;
  console.error("[expert-brain-queue] FATAL", { message, stack, ...extra });
  return NextResponse.json(
    {
      success: false,
      fatal: true,
      message,
      stack,
      ...extra,
    },
    { status: 500 }
  );
}

function importFailedJson(moduleName: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : null;
  console.error("[expert-brain-queue] IMPORT FAILED", { module: moduleName, message, stack });
  return NextResponse.json(
    {
      success: false,
      fatal: true,
      importFailed: true,
      module: moduleName,
      message,
      stack,
    },
    { status: 500 }
  );
}

function readItemSource(item: {
  file_path: string;
  metadata: unknown;
} | null): string | null {
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

const REQUIRED_TABLES = [
  "expert_ingestion_queue",
  "expert_knowledge_sources",
  "expert_frameworks",
  "expert_decision_rules",
  "expert_success_patterns",
  "expert_failure_patterns",
  "expert_transcripts",
] as const;

async function assertExpertBrainInfrastructure(
  supabase: QueueCtx["supabase"],
  filesBucket: string,
  transcriptsBucket: string
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
      console.warn("[expert-brain-queue] table probe warning", { table, error: error.message });
    }
  }

  for (const bucket of [filesBucket, transcriptsBucket]) {
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

export async function POST(request: Request) {
  let step = "enter_post";
  let lastImport: string | null = null;
  const importsLoaded: string[] = [];

  try {
    console.log("[expert-brain-queue] STEP 1 enter_post");

    // --- STEP: parse body (no imports) ---
    step = "parse_body";
    console.log("[expert-brain-queue] STEP 2 parse_body");
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const requestedLimit = typeof body.limit === "number" ? body.limit : 1;
    const effectiveLimit = Math.max(1, Math.min(requestedLimit, 3));
    const action = typeof body.action === "string" ? body.action : "process";

    // --- IMPORT: storage utils ---
    step = "import_storage";
    lastImport = "@/utils/expert-brain-storage";
    console.log("[expert-brain-queue] IMPORT STORAGE", lastImport);
    let EXPERT_BRAIN_FILES_BUCKET: string;
    let EXPERT_BRAIN_TRANSCRIPTS_BUCKET: string;
    try {
      const storageMod = await import("@/utils/expert-brain-storage");
      EXPERT_BRAIN_FILES_BUCKET = storageMod.EXPERT_BRAIN_FILES_BUCKET;
      EXPERT_BRAIN_TRANSCRIPTS_BUCKET = storageMod.EXPERT_BRAIN_TRANSCRIPTS_BUCKET;
      importsLoaded.push(lastImport);
      console.log("[expert-brain-queue] IMPORT STORAGE ok");
    } catch (err) {
      return importFailedJson(lastImport, err);
    }

    // --- IMPORT: auth/context ---
    step = "import_context";
    lastImport = "@/lib/supabase/services/context";
    console.log("[expert-brain-queue] IMPORT SUPABASE CONTEXT", lastImport);
    let getOptionalDataContext: () => Promise<QueueCtx | null>;
    try {
      const contextMod = await import("@/lib/supabase/services/context");
      getOptionalDataContext = contextMod.getOptionalDataContext as unknown as () => Promise<QueueCtx | null>;
      importsLoaded.push(lastImport);
      console.log("[expert-brain-queue] IMPORT SUPABASE CONTEXT ok");
    } catch (err) {
      return importFailedJson(lastImport, err);
    }

    // --- get user ---
    step = "get_user";
    console.log("[expert-brain-queue] STEP 3 get_user");
    const ctx = await getOptionalDataContext();
    const userId = ctx?.userId ?? null;
    console.log("[expert-brain-queue]", { step: "get_user", userId, action, limit: effectiveLimit });

    if (!ctx || !userId) {
      return NextResponse.json(
        {
          success: false,
          step: "get_user",
          error: "Usuário não autenticado.",
          fatal: false,
          importsLoaded,
        },
        { status: 401 }
      );
    }

    // --- infra probe ---
    step = "create_supabase_client";
    console.log("[expert-brain-queue] STEP 4 infra probe");
    const infra = await assertExpertBrainInfrastructure(
      ctx.supabase,
      EXPERT_BRAIN_FILES_BUCKET,
      EXPERT_BRAIN_TRANSCRIPTS_BUCKET
    );
    if (!infra.ok) {
      return NextResponse.json(
        {
          success: false,
          fatal: true,
          step: "create_supabase_client",
          message: infra.missing,
          missing: infra.missing,
          importsLoaded,
        },
        { status: 500 }
      );
    }

    // --- IMPORT: repository ---
    step = "import_repository";
    lastImport = "@/lib/supabase/repositories/expert-brain.repository";
    console.log("[expert-brain-queue] IMPORT REPOSITORY", lastImport);
    let ExpertIngestionQueueRepository: new (
      supabase: QueueCtx["supabase"],
      userId: string
    ) => {
      findWorkable: (limit: number) => Promise<{
        data: Array<{
          id: string;
          status: string;
          file_name: string | null;
          file_path: string;
          metadata: unknown;
        }> | null;
        error: string | null;
      }>;
    };
    try {
      const repoMod = await import("@/lib/supabase/repositories/expert-brain.repository");
      ExpertIngestionQueueRepository =
        repoMod.ExpertIngestionQueueRepository as unknown as typeof ExpertIngestionQueueRepository;
      importsLoaded.push(lastImport);
      console.log("[expert-brain-queue] IMPORT REPOSITORY ok");
    } catch (err) {
      return importFailedJson(lastImport, err);
    }

    // --- IMPORT: ingestion service (pulls AIF pipeline transitively) ---
    step = "import_ingestion_service";
    lastImport = "@/lib/supabase/services/expert-brain-ingestion.service";
    console.log("[expert-brain-queue] IMPORT INGESTION SERVICE", lastImport);
    let processExpertBrainIngestionQueue: (limit?: number) => Promise<{
      success: boolean;
      found: number;
      processed: number;
      completed: number;
      failed: number;
      skipped: number;
      pendingDriveRemaining: number;
      error?: string | null;
      message?: string;
    }>;
    let resetFailedDriveVideos: () => Promise<{
      reset: number;
      scanned: number;
      error: string | null;
    }>;
    try {
      const ingestionMod = await import(
        "@/lib/supabase/services/expert-brain-ingestion.service"
      );
      processExpertBrainIngestionQueue = ingestionMod.processExpertBrainIngestionQueue;
      resetFailedDriveVideos = ingestionMod.resetFailedDriveVideos;
      importsLoaded.push(lastImport);
      console.log("[expert-brain-queue] IMPORT INGESTION SERVICE ok");
    } catch (err) {
      return importFailedJson(lastImport, err);
    }

    // Soft probe: can we load AIF step module without running it?
    step = "import_aif_step";
    lastImport = "@/lib/aif/aif-pipeline-step";
    console.log("[expert-brain-queue] IMPORT AIF", lastImport);
    try {
      await import("@/lib/aif/aif-pipeline-step");
      importsLoaded.push(lastImport);
      console.log("[expert-brain-queue] IMPORT AIF ok");
    } catch (err) {
      return importFailedJson(lastImport, err);
    }

    if (action === "reset_failed_drive") {
      step = "reset_failed_drive";
      console.log("[expert-brain-queue] STEP reset_failed_drive");
      const resetResult = await resetFailedDriveVideos();
      if (resetResult.error) {
        return NextResponse.json(
          {
            success: false,
            fatal: true,
            step: "reset_failed_drive",
            message: resetResult.error,
            reset: resetResult.reset,
            scanned: resetResult.scanned,
            importsLoaded,
          },
          { status: 500 }
        );
      }
      return NextResponse.json({
        success: true,
        step: "response",
        action,
        reset: resetResult.reset,
        scanned: resetResult.scanned,
        memorySafe: true,
        importsLoaded,
        message:
          resetResult.reset > 0
            ? `${resetResult.reset} vídeo(s) do Drive reenfileirado(s) como pending_drive`
            : "Nenhum item failed de Storage do Drive para reprocessar",
      });
    }

    // --- list pending ---
    step = "list_pending_items";
    console.log("[expert-brain-queue] STEP 5 list_pending_items");
    const ingestionRepo = new ExpertIngestionQueueRepository(ctx.supabase, ctx.userId);
    const { data: pendingItems, error: pendingError } =
      await ingestionRepo.findWorkable(effectiveLimit);

    if (pendingError) {
      return NextResponse.json(
        {
          success: false,
          fatal: true,
          step: "list_pending_items",
          message: classifyDbError(pendingError),
          pendingError,
          importsLoaded,
        },
        { status: 500 }
      );
    }

    step = "select_first_item";
    const first = pendingItems?.[0] ?? null;
    const itemId = first?.id ?? null;
    const itemStatus = first?.status ?? null;
    const fileName = first?.file_name ?? null;
    const source = readItemSource(first);

    console.log("[expert-brain-queue]", {
      step: "select_first_item",
      itemId,
      status: itemStatus,
      fileName,
      source,
      metadataKeys: first ? metadataKeys(first.metadata) : [],
      limit: effectiveLimit,
      found: pendingItems?.length ?? 0,
      importsLoaded,
    });

    step = "process_queue_start";
    console.log("[expert-brain-queue] STEP 6 process_queue_start", {
      itemId,
      status: itemStatus,
      fileName,
      source,
      limit: effectiveLimit,
    });

    step = "process_aif_step";
    console.log("[expert-brain-queue] STEP 7 processExpertBrainIngestionQueue");
    const result = await processExpertBrainIngestionQueue(effectiveLimit);

    console.log("[expert-brain-queue] STEP 8 process done", {
      success: result.success,
      processed: result.processed,
      completed: result.completed,
      failed: result.failed,
      error: result.error,
    });

    const remaining =
      (result.pendingDriveRemaining ?? 0) +
      Math.max(0, (result.found ?? 0) - (result.processed ?? 0));

    if (result.error) {
      return NextResponse.json(
        {
          success: false,
          fatal: true,
          step: "update_item",
          message: classifyDbError(result.error),
          originalError: result.error,
          found: result.found,
          processed: result.processed,
          completed: result.completed,
          failed: result.failed,
          skipped: result.skipped,
          remaining,
          itemId,
          status: itemStatus,
          fileName,
          source,
          importsLoaded,
        },
        { status: result.error === "Usuário não autenticado." ? 401 : 500 }
      );
    }

    step = "response";
    console.log("[expert-brain-queue] STEP 9 response ok");
    return NextResponse.json({
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
      importsLoaded,
    });
  } catch (err) {
    console.error("[expert-brain-queue] FATAL CATCH", {
      step,
      lastImport,
      importsLoaded,
      err,
    });
    return fatalJson(err, {
      step,
      lastImport,
      importsLoaded,
      importFailed: lastImport != null && !importsLoaded.includes(lastImport),
      module: lastImport,
    });
  }
}
