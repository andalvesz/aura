import { getRevenueDashboard, syncRevenueWithKiwify } from "@/lib/supabase/services/revenue.service";

export async function GET() {
  await syncRevenueWithKiwify();
  const { dashboard, error } = await getRevenueDashboard();
  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }
  return Response.json({ dashboard });
}
