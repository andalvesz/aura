import { getFunnelPagesDashboard } from "@/lib/supabase/services/funnel-pages.service";
import { jsonRouteError } from "@/utils/api-json-route";

export async function GET() {
  try {
    const { dashboard, bundles, error } = await getFunnelPagesDashboard();

    if (error) {
      return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
    }

    return Response.json({ dashboard, bundles });
  } catch (error) {
    return jsonRouteError("funnel-pages", error);
  }
}

export async function POST() {
  return Response.json(
    { error: "Use POST /api/funnel-pages/generate para gerar páginas do funil." },
    { status: 405 }
  );
}
