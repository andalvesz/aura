import { getOfferEngineDashboard } from "@/lib/supabase/services/offer-engine.service";
import { jsonRouteError } from "@/utils/api-json-route";

export async function GET() {
  try {
    const { dashboard, stacks, error } = await getOfferEngineDashboard();

    if (error) {
      return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
    }

    return Response.json({ dashboard, stacks });
  } catch (error) {
    return jsonRouteError("offer-engine", error);
  }
}

export async function POST() {
  return Response.json(
    { error: "Use POST /api/offer-engine/generate para gerar a stack de ofertas." },
    { status: 405 }
  );
}
