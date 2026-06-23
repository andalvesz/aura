import { importGoogleDriveFolder } from "@/lib/supabase/services/google-drive.service";

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

    return Response.json({ queued, error });
  } catch {
    return Response.json({ error: "Erro na requisição." }, { status: 500 });
  }
}
