import { listGoogleDriveFolders } from "@/lib/supabase/services/google-drive.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parentId = url.searchParams.get("parentId");

  const { folders, email, accountName, error } = await listGoogleDriveFolders(parentId);

  if (error) {
    return Response.json({ error, connected: false, email, accountName, folders: [] }, { status: 400 });
  }

  return Response.json({ folders, email, accountName, connected: true });
}
