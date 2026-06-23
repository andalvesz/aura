import { getDriveBrowse } from "@/lib/supabase/services/knowledge-sources.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parentId = url.searchParams.get("parentId");

  const { folders, files, error } = await getDriveBrowse(parentId);

  if (error) {
    return Response.json({ error }, { status: 400 });
  }

  return Response.json({ folders, files });
}
