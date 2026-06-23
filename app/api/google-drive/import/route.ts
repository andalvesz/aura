import { importGoogleDriveFolder } from "@/lib/supabase/services/google-drive.service";
import { processExpertBrainIngestionQueue } from "@/lib/supabase/services/expert-brain-ingestion.service";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      folderId?: string;
      folderName?: string;
    };

    const { queued, error } = await importGoogleDriveFolder({
      folderId: body.folderId ?? "",
      folderName: body.folderName ?? "",
    });

    if (error && queued === 0) {
      return Response.json({ error }, { status: 400 });
    }

    let processed = 0;
    let failed = 0;
    if (queued > 0) {
      const ingestResult = await processExpertBrainIngestionQueue(Math.min(queued, 10));
      processed = ingestResult.processed;
      failed = ingestResult.failed;
    }

    return Response.json({ queued, processed, failed, error });
  } catch {
    return Response.json({ error: "Erro na requisição." }, { status: 500 });
  }
}
