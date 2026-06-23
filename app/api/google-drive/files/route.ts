import { listGoogleDriveFiles } from "@/lib/supabase/services/google-drive.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const folderId = url.searchParams.get("folderId");

  if (!folderId) {
    return Response.json({ error: "Informe folderId." }, { status: 400 });
  }

  const { files, error } = await listGoogleDriveFiles(folderId);

  if (error) {
    return Response.json({ error, files: [] }, { status: 400 });
  }

  return Response.json({ files });
}
