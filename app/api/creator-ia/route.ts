import OpenAI, { APIError } from "openai";
import {
  buildOpenAiMessagesWithMemory,
  persistAiTurn,
} from "@/lib/ai/memory-runtime";
import { getCreatorContext } from "@/lib/supabase/services/creator.service";
import { resolveMergedHistory } from "@/lib/supabase/services/memory.service";
import { CREATOR_AI_CONTEXT, CREATOR_IA_ACTIONS } from "@/utils/creator";
import { parseRequestJson } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const ACTION_PROMPTS: Record<string, string> = Object.fromEntries(
  CREATOR_IA_ACTIONS.map((a) => [a.id, a.prompt])
);

function resolveError(error: unknown, fallback: string): string {
  if (error instanceof APIError) {
    if (error.code === "insufficient_quota") {
      return "Sua API da OpenAI está sem créditos.";
    }
    if (error.code === "invalid_api_key" || error.status === 401) {
      return "Chave da OpenAI inválida.";
    }
  }
  return fallback;
}

export async function POST(req: Request) {
  try {
    const { data: body, error: bodyError } = await parseRequestJson<{
      message?: string;
      actionId?: string;
      history?: unknown;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const actionId =
      typeof body.actionId === "string" ? body.actionId.trim() : "";
    let message = typeof body.message === "string" ? body.message.trim() : "";

    if (actionId && ACTION_PROMPTS[actionId]) {
      message = ACTION_PROMPTS[actionId]!;
    }

    if (!message) {
      return Response.json({ error: "Descreva o que você precisa." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "IA indisponível (OPENAI_API_KEY)." }, { status: 503 });
    }

    const { context, error: dataError } = await getCreatorContext();

    if (dataError === "Usuário não autenticado.") {
      return Response.json({ error: "Faça login para usar a Aura Creator." }, { status: 401 });
    }

    const history: ChatMessage[] = Array.isArray(body.history)
      ? body.history.filter(
          (m: unknown): m is ChatMessage =>
            typeof m === "object" &&
            m !== null &&
            "role" in m &&
            "content" in m &&
            (m.role === "user" || m.role === "assistant") &&
            typeof m.content === "string"
        )
      : [];

    const systemPrompt = `${CREATOR_AI_CONTEXT}\n\n${context ?? "## CREATOR\nSem dados."}`;
    const mergedHistory = await resolveMergedHistory("creator", history);

    const messages = await buildOpenAiMessagesWithMemory({
      module: "creator",
      userMessage: message,
      systemPrompt,
      clientHistory: history,
      mergedHistory,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
    });

    const text =
      response.choices[0]?.message?.content ?? "Não consegui responder agora.";

    await persistAiTurn("creator", message, text, {
      kind: "creator",
      actionId: actionId || undefined,
    });

    return Response.json({ text, kind: "creator" });
  } catch (error) {
    console.error("[creator-ia]", error);
    return Response.json(
      { error: resolveError(error, "Erro ao processar. Tente novamente.") },
      { status: 500 }
    );
  }
}
