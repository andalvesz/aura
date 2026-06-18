import { generateForecast } from "@/lib/supabase/services/revenue-ai.service";

export async function POST(request: Request) {
  let body: { period?: string; type?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const period = body.period as "weekly" | "monthly" | "quarterly" | undefined;
  const forecastType = body.type as "revenue" | "profit" | "growth" | "scale" | undefined;

  const { forecast, result, error } = await generateForecast({
    period,
    forecastType,
  });

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ forecast, result, message: "Previsão gerada." });
}
