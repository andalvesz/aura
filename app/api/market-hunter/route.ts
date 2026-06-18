import { getMarketHunterDashboard } from "@/lib/supabase/services/market-hunter.service";

export async function GET() {
  const { dashboard, error } = await getMarketHunterDashboard();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ dashboard });
}

export async function POST() {
  return Response.json(
    { error: "Use POST /api/market-hunter/analyze para executar análise de mercado." },
    { status: 405 }
  );
}
