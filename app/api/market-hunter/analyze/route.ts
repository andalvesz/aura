import { identifyOpportunities } from "@/lib/supabase/services/market-hunter.service";

export async function POST() {
  const { opportunities, error } = await identifyOpportunities();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({
    message: `${opportunities.length} oportunidades identificadas.`,
    opportunities,
  });
}
