import { analyzeGlobalMarkets } from "@/lib/supabase/services/global-intelligence.service";
import { parseRequestJson } from "@/utils/safe-json";
import type { GlobalMarketIntake } from "@/utils/global";

export async function POST(request: Request) {
  const { data: body, error: parseError } = await parseRequestJson<GlobalMarketIntake>(request);

  if (parseError || !body) {
    return Response.json({ error: parseError ?? "JSON inválido." }, { status: 400 });
  }

  if (!body.product_type || !body.objective) {
    return Response.json({ error: "Informe product_type e objective." }, { status: 400 });
  }

  const { markets, strategies, error } = await analyzeGlobalMarkets(body);

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ markets, strategies });
}
