import { syncKiwifyConnection } from "@/lib/supabase/services/kiwify-connect.service";

export async function POST() {
  const result = await syncKiwifyConnection();
  if (result.error) {
    return Response.json({ error: result.error }, { status: 422 });
  }
  return Response.json(result);
}
