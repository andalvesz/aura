import { getLatestAppliedKnowledge } from "@/lib/supabase/services/knowledge-influence.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const module = url.searchParams.get("module")?.trim();

  if (!module) {
    return Response.json({ error: "Módulo obrigatório." }, { status: 400 });
  }

  const appliedKnowledge = await getLatestAppliedKnowledge(module);
  return Response.json({ appliedKnowledge });
}
