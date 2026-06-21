import { getExpertBrainDashboard } from "@/lib/supabase/services/expert-brain-dashboard.service";

export async function GET() {
  const { dashboard, error } = await getExpertBrainDashboard();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ dashboard });
}
