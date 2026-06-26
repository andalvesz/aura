import { importGoogleDriveFolder } from "@/lib/supabase/services/google-drive.service";
import { processExpertBrainIngestionQueue } from "@/lib/supabase/services/expert-brain-ingestion.service";

function driveImportErrorResponse(
  status: number,
  params: {
    error: string;
    reason: string;
    folderId?: string | null;
    folderName?: string | null;
  }
) {
  return Response.json(
    {
      error: params.error,
      reason: params.reason,
      folderId: params.folderId ?? null,
      folderName: params.folderName ?? null,
    },
    { status }
  );
}

export async function POST(request: Request) {
  let folderId: string | null = null;
  let folderName: string | null = null;

  try {
    const body = (await request.json()) as {
      folderId?: string;
      folderName?: string;
    };

    folderId = body.folderId?.trim() ?? null;
    folderName = body.folderName?.trim() ?? null;

    console.info("[drive-import] request", {
      folderId,
      folderName,
      bodyKeys: Object.keys(body),
    });

    if (!folderId || !folderName) {
      const reason = "Informe pasta do curso (folderId e folderName).";
      console.info("[drive-import] complete", { status: 400, reason, folderId, folderName });
      return driveImportErrorResponse(400, {
        error: reason,
        reason,
        folderId,
        folderName,
      });
    }

    const { queued, error } = await importGoogleDriveFolder({
      folderId,
      folderName,
    });

    if (error && queued === 0) {
      console.info("[drive-import] complete", { status: 400, queued, error, folderId, folderName });
      return driveImportErrorResponse(400, {
        error,
        reason: error,
        folderId,
        folderName,
      });
    }

    let processed = 0;
    let failed = 0;
    let found = 0;
    let ingestMessage: string | null = null;

    if (queued > 0) {
      const ingestResult = await processExpertBrainIngestionQueue(Math.min(queued, 10));
      processed = ingestResult.processed;
      failed = ingestResult.failed;
      found = ingestResult.found;
      ingestMessage = ingestResult.message;

      if (!ingestResult.success && ingestResult.pendingDriveRemaining > 0) {
        console.warn("[drive-import] queue", {
          stage: "post-import",
          pendingDriveRemaining: ingestResult.pendingDriveRemaining,
          message: ingestResult.message,
        });
      }
    }

    console.info("[drive-import] complete", {
      status: 200,
      queued,
      found,
      processed,
      failed,
      error,
      folderId,
      folderName,
    });

    return Response.json({
      queued,
      found,
      processed,
      failed,
      error,
      message: ingestMessage,
      folderId,
      folderName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro na requisição.";
    console.error("[drive-import] error", {
      message,
      name: err instanceof Error ? err.name : typeof err,
      stack: err instanceof Error ? err.stack : undefined,
      folderId,
      folderName,
    });
    return driveImportErrorResponse(500, {
      error: message,
      reason: message,
      folderId,
      folderName,
    });
  }
}
