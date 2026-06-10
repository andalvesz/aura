import { syncAllIntegrations } from "@/lib/supabase/services/integration-center.service";

export async function POST() {
  const result = await syncAllIntegrations();
  if (result.error && !result.data) {
    return Response.json({ error: result.error }, { status: 422 });
  }
  return Response.json({ data: result.data, error: result.error });
}
