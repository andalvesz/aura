import OpenAI, { APIError } from "openai";
import {
  buildOpenAiMessagesWithMemory,
  persistAiTurn,
} from "@/lib/ai/memory-runtime";
import { getCopylabContext } from "@/lib/supabase/services/copylab.service";
import { getCreatorContext } from "@/lib/supabase/services/creator.service";
import { getStudioContext } from "@/lib/supabase/services/creative-studio.service";
import { getLaunchContext } from "@/lib/supabase/services/launch.service";
import { getLandingContext } from "@/lib/supabase/services/landing-builder.service";
import { getAdsContext } from "@/lib/supabase/services/ads-manager.service";
import { getResearchContext } from "@/lib/supabase/services/research.service";
import { resolveMergedHistory } from "@/lib/supabase/services/memory.service";
import { COPYLAB_AI_CONTEXT, COPYLAB_IA_ACTIONS } from "@/utils/copylab";
import { CREATOR_AI_CONTEXT, CREATOR_IA_ACTIONS } from "@/utils/creator";
import { STUDIO_AI_CONTEXT, STUDIO_IA_ACTIONS } from "@/utils/creative-studio";
import { LAUNCH_AI_CONTEXT, LAUNCH_IA_ACTIONS } from "@/utils/launch";
import { LANDING_AI_CONTEXT, LANDING_IA_ACTIONS } from "@/utils/landing-builder";
import { ADS_AI_CONTEXT, ADS_IA_ACTIONS } from "@/utils/ads-manager";
import { RESEARCH_AI_CONTEXT, RESEARCH_IA_ACTIONS } from "@/utils/research";
import { parseRequestJson } from "@/utils/safe-json";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const ACTION_PROMPTS: Record<string, string> = Object.fromEntries([
  ...CREATOR_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...RESEARCH_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...COPYLAB_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...STUDIO_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...LANDING_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...ADS_IA_ACTIONS.map((a) => [a.id, a.prompt]),
  ...LAUNCH_IA_ACTIONS.map((a) => [a.id, a.prompt]),
]);

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
      module?: string;
    }>(req);

    if (bodyError || !body) {
      return Response.json({ error: bodyError ?? "Requisição inválida." }, { status: 400 });
    }

    const actionId =
      typeof body.actionId === "string" ? body.actionId.trim() : "";
    let message = typeof body.message === "string" ? body.message.trim() : "";
    const isResearch = body.module === "research";
    const isCopylab = body.module === "copylab";
    const isStudio = body.module === "studio";
    const isLanding = body.module === "landing";
    const isAds = body.module === "ads";
    const isLaunch = body.module === "launch";

    if (actionId && ACTION_PROMPTS[actionId]) {
      message = ACTION_PROMPTS[actionId]!;
    }

    if (!message) {
      return Response.json({ error: "Descreva o que você precisa." }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "IA indisponível (OPENAI_API_KEY)." }, { status: 503 });
    }

    const [creatorCtx, researchCtx, copylabCtx, studioCtx, landingCtx, adsCtx, launchCtx] =
      await Promise.all([
        getCreatorContext(),
        getResearchContext(),
        getCopylabContext(),
        getStudioContext(),
        getLandingContext(),
        getAdsContext(),
        getLaunchContext(),
      ]);

    if (
      creatorCtx.error === "Usuário não autenticado." ||
      researchCtx.error === "Usuário não autenticado." ||
      copylabCtx.error === "Usuário não autenticado." ||
      studioCtx.error === "Usuário não autenticado." ||
      landingCtx.error === "Usuário não autenticado." ||
      adsCtx.error === "Usuário não autenticado." ||
      launchCtx.error === "Usuário não autenticado."
    ) {
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

    const baseContext = [
      creatorCtx.context,
      researchCtx.context,
      copylabCtx.context,
      studioCtx.context,
      landingCtx.context,
      adsCtx.context,
      launchCtx.context,
    ]
      .filter(Boolean)
      .join("\n\n");
    const systemPrompt = isResearch
      ? `${RESEARCH_AI_CONTEXT}\n\n${baseContext || "Sem dados."}`
      : isCopylab
        ? `${COPYLAB_AI_CONTEXT}\n\n${baseContext || "Sem dados."}`
        : isStudio
          ? `${STUDIO_AI_CONTEXT}\n\n${baseContext || "Sem dados."}`
          : isLanding
            ? `${LANDING_AI_CONTEXT}\n\n${baseContext || "Sem dados."}`
            : isAds
              ? `${ADS_AI_CONTEXT}\n\n${baseContext || "Sem dados."}`
              : isLaunch
                ? `${LAUNCH_AI_CONTEXT}\n\n${baseContext || "Sem dados."}`
                : `${CREATOR_AI_CONTEXT}\n\n${baseContext || "Sem dados."}`;

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

    const kind = isResearch
      ? "research"
      : isCopylab
        ? "copylab"
        : isStudio
          ? "studio"
          : isLanding
            ? "landing"
            : isAds
              ? "ads"
              : isLaunch
                ? "launch"
                : "creator";

    await persistAiTurn("creator", message, text, {
      kind,
      actionId: actionId || undefined,
    });

    return Response.json({ text, kind });
  } catch (error) {
    console.error("[creator-ia]", error);
    return Response.json(
      { error: resolveError(error, "Erro ao processar. Tente novamente.") },
      { status: 500 }
    );
  }
}
