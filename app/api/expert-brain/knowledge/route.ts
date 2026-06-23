import { getExpertKnowledgeBySourceId } from "@/lib/supabase/services/expert-brain-dashboard.service";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceId = searchParams.get("sourceId");

  if (!sourceId) {
    return Response.json({ error: "Informe sourceId." }, { status: 400 });
  }

  const { knowledge, error } = await getExpertKnowledgeBySourceId(sourceId);

  if (error || !knowledge) {
    const status = error === "Usuário não autenticado." ? 401 : 404;
    return Response.json({ error: error ?? "Conhecimento não encontrado." }, { status });
  }

  return Response.json({ knowledge });
}
