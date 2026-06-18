import { getFunnelEngineDashboard } from "@/lib/supabase/services/funnel-engine.service";

export async function GET() {
  const { dashboard, bundles, error } = await getFunnelEngineDashboard();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ dashboard, bundles });
}

export async function POST() {
  return Response.json(
    { error: "Use POST /api/funnel-engine/generate para gerar um funil." },
    { status: 405 }
  );
}
