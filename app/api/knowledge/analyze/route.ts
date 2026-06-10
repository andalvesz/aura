import { generateKnowledgeInsights } from "@/lib/supabase/services/knowledge.service";

export async function POST() {
  const { insights, error } = await generateKnowledgeInsights();

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ insights, count: insights.length });
}
