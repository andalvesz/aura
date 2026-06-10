import { getKiwifyConnectDashboard } from "@/lib/supabase/services/kiwify-connect.service";

export async function GET() {
  const result = await getKiwifyConnectDashboard();
  if (result.error) {
    return Response.json({ error: result.error }, {
      status: result.error === "Usuário não autenticado." ? 401 : 500,
    });
  }
  return Response.json(result.data);
}
