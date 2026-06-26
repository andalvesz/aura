import { getFunnelEngineDashboard } from "@/lib/supabase/services/funnel-engine.service";
import { jsonRouteError } from "@/utils/api-json-route";

export async function GET() {
  try {
    const { dashboard, bundles, error } = await getFunnelEngineDashboard();

    if (error) {
      return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
    }

    return Response.json({ dashboard, bundles });
  } catch (error) {
    return jsonRouteError("funnel-engine", error);
  }
}

export async function POST() {
  return Response.json(
    { error: "Use POST /api/funnel-engine/generate para gerar um funil." },
    { status: 405 }
  );
}
