import { getIntegrationCenterDashboard } from "@/lib/supabase/services/integration-center.service";

export async function GET() {
  const result = await getIntegrationCenterDashboard();
  if (result.error) {
    return Response.json({ error: result.error }, { status: 401 });
  }
  return Response.json(result.data);
}
