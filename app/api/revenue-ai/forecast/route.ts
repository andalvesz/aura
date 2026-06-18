import { getLatestForecast } from "@/lib/supabase/services/revenue-ai.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") as "weekly" | "monthly" | "quarterly" | null;
  const forecastType = searchParams.get("type") as
    | "revenue"
    | "profit"
    | "growth"
    | "scale"
    | null;

  const { forecast, result, error } = await getLatestForecast({
    period: period ?? undefined,
    forecastType: forecastType ?? undefined,
  });

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ forecast, result });
}
