import { getPlatformsIaReply } from "@/lib/supabase/services/platform-hub.service";
import { PLATFORMS_AI_CONTEXT } from "@/utils/platforms";
import { parseRequestJson } from "@/utils/safe-json";

export async function POST(request: Request) {
  const { data: body, error: parseError } = await parseRequestJson<{
    message?: string;
    actionId?: string;
  }>(request);

  if (parseError || !body?.message?.trim()) {
    return Response.json({ error: parseError ?? "Mensagem obrigatória." }, { status: 400 });
  }

  const { text, error } = await getPlatformsIaReply({
    message: body.message.trim(),
    actionId: body.actionId,
  });

  if (error) {
    return Response.json(
      { error },
      { status: error === "Usuário não autenticado." ? 401 : 500 }
    );
  }

  return Response.json({ text, context: PLATFORMS_AI_CONTEXT });
}
