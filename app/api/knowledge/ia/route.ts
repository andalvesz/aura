import { getKnowledgeIaReply } from "@/lib/supabase/services/knowledge.service";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(request: Request) {
  const { data: body, error: parseError } = await parseRequestJson<{
    message?: string;
    actionId?: string;
  }>(request);

  if (parseError || !body?.message?.trim()) {
    return Response.json({ error: parseError ?? "Informe message." }, { status: 400 });
  }

  const { text, error } = await getKnowledgeIaReply({
    message: body.message.trim(),
    actionId: body.actionId,
  });

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ text });
}
