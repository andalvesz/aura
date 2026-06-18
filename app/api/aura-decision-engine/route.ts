import { getUnifiedDecisions } from "@/lib/supabase/services/aura-decision-engine.service";

export async function GET() {
  const { decisions, error } = await getUnifiedDecisions();

  if (error) {
    return Response.json({ error }, { status: error === "Usuário não autenticado." ? 401 : 500 });
  }

  return Response.json({ decisions });
}
