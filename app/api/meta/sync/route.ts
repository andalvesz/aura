import { syncMetaConnection } from "@/lib/supabase/services/meta-connect.service";

export async function POST() {
  const result = await syncMetaConnection();
  if (result.error) {
    return Response.json({ error: result.error }, { status: 422 });
  }
  return Response.json(result);
}
