import { importGoogleDriveFolder } from "@/lib/supabase/services/google-drive.service";
import { processExpertBrainIngestionQueue } from "@/lib/supabase/services/expert-brain-ingestion.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      folderId?: string;
      folderName?: string;
    };

    console.info("[drive-import] request", {
      folderId: body.folderId ?? null,
      folderName: body.folderName ?? null,
      bodyKeys: Object.keys(body),
    });

    const { queued, error } = await importGoogleDriveFolder({
      folderId: body.folderId ?? "",
      folderName: body.folderName ?? "",
    });

    if (error && queued === 0) {
      console.info("[drive-import] complete", { status: 400, queued, error });
      return Response.json({ error }, { status: 400 });
    }

    let processed = 0;
    let failed = 0;
    if (queued > 0) {
      const ingestResult = await processExpertBrainIngestionQueue(Math.min(queued, 10));
      processed = ingestResult.processed;
      failed = ingestResult.failed;
    }

    console.info("[drive-import] complete", { status: 200, queued, processed, failed, error });
    return Response.json({ queued, processed, failed, error });
  } catch (err) {
    console.error("[drive-import] error", {
      message: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : typeof err,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return Response.json({ error: "Erro na requisição." }, { status: 500 });
  }
}
