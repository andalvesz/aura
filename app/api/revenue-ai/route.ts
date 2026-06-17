import { getRevenueAiDashboard } from "@/lib/supabase/services/revenue-ai.service";

export async function GET() {
  const { dashboard, error } = await getRevenueAiDashboard();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ dashboard });
}
